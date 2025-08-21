import {
	InstanceBase,
	Regex,
	runEntrypoint,
	InstanceStatus,
	SomeCompanionConfigField,
	CompanionVariableValues,
} from '@companion-module/base'

import { ApolloClient, NormalizedCacheObject } from '@apollo/client'

import { getApolloClient } from './apolloClient.js'
import { getDomain } from './dante-api/getDomain.js'
import { getDomainOptimized } from './dante-api/getDomainOptimized.js'
import { getDomainSubscriptions } from './dante-api/getDomainSubscriptions.js'
import { getDomains } from './dante-api/getDomains.js'

import { DomainQuery, DomainsQuery } from './graphql-codegen/graphql.js'

import { ConfigType } from './config.js'
import UpgradeScripts from './upgrades.js'
import generateActions from './actions.js'
import generateFeedbacks from './feedbacks.js'
import { generatePresets } from './presets.js'
import { generateVariables } from './variables.js'

export class AudinateDanteModule extends InstanceBase<ConfigType> {
	config: ConfigType
	variables: CompanionVariableValues

	domains?: DomainsQuery['domains']
	domain: DomainQuery['domain']
	apolloClient?: ApolloClient<NormalizedCacheObject>

	// Cache of last generated definitions to avoid unnecessary UI rebuilds
	private _lastActionsHash?: string
	private _lastFeedbacksHash?: string

	pollDomainAndUpdateFeedbacksInterval?: NodeJS.Timeout
	
	// Performance tracking
	private pollCount = 0

	constructor(internal: unknown) {
		super(internal)
		this.config = <ConfigType>{}
		this.variables = <CompanionVariableValues>{}
		this.domains = <DomainsQuery['domains']>[]
		this.domain = <DomainQuery['domain']>{}
	}

	async init(config: ConfigType): Promise<void> {
		this.config = config

		delete this.domains
		delete this.domain
		delete this.apolloClient
		clearInterval(this.pollDomainAndUpdateFeedbacksInterval)
		delete this.pollDomainAndUpdateFeedbacksInterval

		this.variables = {}

		if (!this.config.apihost) {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'API host not set')
			return
		}

		if (!this.config.apikey) {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'API key not set')
			return
		}

		this.log('info', `Creating ApolloClient`)
		this.apolloClient = getApolloClient(this, this.config.apihost, this.config.apikey)

		this.log('info', `Setting up companion components...`)
		this.setVariableDefinitions(generateVariables())
		this._maybeUpdateFeedbacks()
		this._maybeUpdateActions()
		this.setPresetDefinitions(generatePresets())

		// Start in connecting state while background tasks warm up
		this.updateStatus(InstanceStatus.Connecting, 'Initializing...')

		// Kick off domain discovery in the background (do not block init)
		void (async () => {
			this.log('info', `Getting list of available Domains`)
			this.domains = await getDomains(this)
			
			// Debug domain discovery
			if (!this.domains) {
				this.log('error', 'Failed to get domains list - check API connection and credentials')
				return
			}
			
			this.log('debug', `Found ${this.domains.length} domains: ${JSON.stringify(this.domains.map(d => ({id: d?.id, name: d?.name})))}`)
			
			if (this.domains.length === 0) {
				this.updateStatus(InstanceStatus.Connecting, 'No domains discovered - check your API key permissions')
			} else if (this.config.domainID && this.config.domainID !== 'default') {
				// If a domain is already selected, try an immediate poll
				this.log('debug', `Domain ${this.config.domainID} selected, polling for device data...`)
				await this.pollDomainAndUpdateFeedbacks()
				// Update feedback and action definitions now that we have domain data
				this._maybeUpdateFeedbacks()
				this._maybeUpdateActions()
			} else {
				this.log('info', 'Domains loaded but no domain selected. Please select a domain in module configuration.')
				this.updateStatus(InstanceStatus.BadConfig, 'Please select a domain')
			}
		})()

		// Use adaptive polling - start at 5s for large domains, can be made configurable
		const pollInterval = this.config.pollInterval || 5000
		this.log('info', `Setting up domain update polling (${pollInterval}ms)...`)
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.pollDomainAndUpdateFeedbacksInterval = setInterval(async () => {
			await this.pollDomainAndUpdateFeedbacks()
		}, pollInterval)
	}

	async pollDomainAndUpdateFeedbacks(): Promise<void> {
		if (!this.config.domainID || this.config.domainID == 'default') {
			this.updateStatus(InstanceStatus.BadConfig, 'Domain not selected. Please select a domain')
			return
		}

		this.log('debug', `Getting specified Domain (${this.config.domainID})`)

		try {
            // Decide between lightweight subscription-only polls and full domain fetches.
            // Perform a full fetch on the first poll and every 10th poll to refresh full metadata.
            this.pollCount++
			const fullFetchInterval = this.config.fullFetchInterval || 10
			const doFullFetch = this.pollCount === 1 || this.pollCount % fullFetchInterval === 0
			if (doFullFetch) {
				this.log('debug', `Poll ${this.pollCount}: performing full domain fetch`)
				this.domain = await getDomainOptimized(this, true)
			} else {
				this.log('debug', `Poll ${this.pollCount}: fetching domain subscription state`)
				this.domain = await getDomainSubscriptions(this, true) // network-first for up-to-date subscription state
			}

			if (!this.domain) {
				this.log('error', `Domain ${this.config.domainID} not found. Available domains: ${JSON.stringify(this.domains?.map(d => d?.id))}`)
				this.updateStatus(InstanceStatus.Connecting, 'Domain not found. Please check the selected domain')
				return
			}

			this.updateStatus(InstanceStatus.Ok, 'Successfully polled domain')
			
			// Debug logging for domain data
			const deviceCount = this.domain?.devices?.length ?? 0
			const rxChannelCount = this.domain?.devices?.reduce((total, device) => 
				total + (device?.rxChannels?.length ?? 0), 0) ?? 0
			const txChannelCount = this.domain?.devices?.reduce((total, device) => 
				total + (device?.txChannels?.length ?? 0), 0) ?? 0
			this.log('debug', `Domain loaded: ${deviceCount} devices, ${rxChannelCount} RX channels, ${txChannelCount} TX channels`)
			
			// Detailed device debugging (show first few devices)
			if (deviceCount > 0) {
				const firstDevice = this.domain?.devices?.[0]
				this.log('debug', `First device: ${firstDevice?.name} (ID: ${firstDevice?.id}) - RX: ${firstDevice?.rxChannels?.length ?? 0}, TX: ${firstDevice?.txChannels?.length ?? 0}`)
			} else {
				this.log('warn', 'No devices found in domain! Check domain selection and API connectivity.')
			}
			
			// Update feedback and action definitions with fresh data
			// Skip feedback updates for very large domains to prevent system hangs
			const maxChannels = this.config.maxChannelsForDropdowns || 500
			if (rxChannelCount > maxChannels) {
				this.log('warn', `Large domain detected (${rxChannelCount} RX channels > ${maxChannels} limit). Using text-input feedbacks to prevent system hang.`)
				if (this.pollCount === 1) {
					// Only generate minimal feedbacks once for large domains
					this._maybeUpdateFeedbacks()
					this._maybeUpdateActions()
				}
				// Always check feedbacks since we always have fresh data now
				this.checkFeedbacks()
			} else {
				// For normal-sized domains, update definitions periodically and always check feedbacks
				if (this.pollCount === 1 || this.pollCount % 10 === 0) {
					this.log('debug', 'Updating feedback and action definitions with fresh domain data')
					this._maybeUpdateFeedbacks()
					this._maybeUpdateActions()
				}
				// Always check feedbacks since we always have fresh data now
				this.checkFeedbacks()
			}
		} catch (error) {
			this.log('error', `Error in pollDomainAndUpdateFeedbacks: ${error}`)
			// Fall back to original getDomain on error
			this.domain = await getDomain(this)
			if (this.domain) {
				this.updateStatus(InstanceStatus.Ok, 'Successfully polled domain (fallback)')
				this.checkFeedbacks()
			}
		}
	}

	async forceFullFetch(): Promise<void> {
		if (!this.config.domainID || this.config.domainID == 'default') {
			this.log('warn', 'Cannot force full fetch: Domain not selected')
			this.updateStatus(InstanceStatus.BadConfig, 'Domain not selected. Please select a domain')
			return
		}

		this.log('info', 'Force full fetch requested - performing immediate full domain refresh')

		try {
			// Force a full network fetch (bypass cache)
			this.domain = await getDomainOptimized(this, true)

			if (!this.domain) {
				this.log('error', `Domain ${this.config.domainID} not found during force full fetch`)
				this.updateStatus(InstanceStatus.Connecting, 'Domain not found during force refresh')
				return
			}

			this.updateStatus(InstanceStatus.Ok, 'Force full fetch completed successfully')
			
			// Debug logging for domain data
			const deviceCount = this.domain?.devices?.length ?? 0
			const rxChannelCount = this.domain?.devices?.reduce((total, device) => 
				total + (device?.rxChannels?.length ?? 0), 0) ?? 0
			const txChannelCount = this.domain?.devices?.reduce((total, device) => 
				total + (device?.txChannels?.length ?? 0), 0) ?? 0
			this.log('info', `Force full fetch completed: ${deviceCount} devices, ${rxChannelCount} RX channels, ${txChannelCount} TX channels`)
			
			// Update feedback and action definitions with fresh data
			this._maybeUpdateFeedbacks()
			this._maybeUpdateActions()
			
			// Force feedback check with fresh data
			this.checkFeedbacks()
			
		} catch (error) {
			this.log('error', `Error in forceFullFetch: ${error}`)
			this.updateStatus(InstanceStatus.Disconnected, `Force full fetch failed: ${error}`)
		}
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'Destroying the module instance')
		clearInterval(this.pollDomainAndUpdateFeedbacksInterval)
	}

	async configUpdated(config: ConfigType): Promise<void> {
		this.log('info', `Configuration updated`)
		this.log('debug', JSON.stringify({ ...config, apikey: '**********' }, null, 2))
		await this.init(config)
	}

	// Only set action definitions if they changed to avoid UI thrash
	private _maybeUpdateActions(): void {
		try {
			const actions = generateActions(this)
			const hash = JSON.stringify(actions)
			if (hash !== this._lastActionsHash) {
				this.log('debug', 'Action definitions changed, updating UI')
				this.setActionDefinitions(actions)
				this._lastActionsHash = hash
			} else {
				this.log('debug', 'Action definitions unchanged, skipping update')
			}
		} catch (e) {
			this.log('error', `Error updating actions: ${e}`)
		}
	}

	// Only set feedback definitions if they changed to avoid UI thrash
	private _maybeUpdateFeedbacks(): void {
		try {
			const feedbacks = generateFeedbacks(this)
			const hash = JSON.stringify(feedbacks)
			if (hash !== this._lastFeedbacksHash) {
				this.log('debug', 'Feedback definitions changed, updating UI')
				this.setFeedbackDefinitions(feedbacks)
				this._lastFeedbacksHash = hash
			} else {
				this.log('debug', 'Feedback definitions unchanged, skipping update')
			}
		} catch (e) {
			this.log('error', `Error updating feedbacks: ${e}`)
		}
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		const RegexURL = '[(http(s)?)://(www.)?a-zA-Z0-9@:%._+~#=]{2,256}.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)'

		return [
			{
				id: 'apihost',
				type: 'textinput',
				label: 'API Host URL',
				default: 'https://api.director.dante.cloud:443/graphql',
				width: 8,
				regex: RegexURL,
			},
			{
				id: 'apikey',
				type: 'textinput',
				label: 'API Key',
				width: 8,
				regex: Regex.SOMETHING,
			},
			{
				id: 'domainID',
				type: 'dropdown',
				label: 'Domain',
				width: 8,
				// isVisible: (configValues) => {
				// 	if (configValues.apikey) {
				// 		return true
				// 	}
				// 	return false
				// },
				default: 'default',
				choices: [
					{ id: 'default', label: 'None' },
					...(this.domains?.map((d) => {
						if (d && d.id && d.name) {
							return {
								id: d.id,
								label: d.name,
							}
						}
						return { id: '', label: '' }
					}) ?? []),
				],
			},
			{
				id: 'disableCertificateValidation',
				type: 'checkbox',
				label: 'Disable certificate validation',
				width: 8,
				tooltip: 'For HTTP endpoints, setting this value has no affect',
				default: false,
			},
			{
				id: 'pollInterval',
				type: 'number',
				label: 'Poll Interval (ms)',
				width: 8,
				tooltip: 'How often to refresh domain data. Range: 1000ms (1s) to 60000ms (60s).',
				default: 30000,
				min: 1000,
				max: 60000,
			},
			{
				id: 'fullFetchInterval',
				type: 'number',
				label: 'Full Fetch Interval (polls)',
				width: 8,
				tooltip: 'How often (in number of polls) to perform a full domain fetch. Default 10.',
				default: 10,
				min: 1,
				max: 1000,
			},
			{
				id: 'maxChannelsForDropdowns',
				type: 'number',
				label: 'Max Channels for Dropdown UI',
				width: 8,
				tooltip: 'Maximum RX channels before switching to text-input mode to prevent UI hangs.',
				default: 500,
				min: 10,
				max: 10000,
			},
			{
				id: 'message',
				type: 'static-text',
				label: 'Reminder',
				value: 'The module must be restarted manually for these settings to take effect',
				width: 8,
			},
		]
	}
}

runEntrypoint(AudinateDanteModule, UpgradeScripts)
