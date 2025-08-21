import { CompanionActionDefinitions, SomeCompanionActionInputField } from '@companion-module/base'
import { setDeviceSubscriptions, setMultipleChannelDeviceSubscriptions } from './dante-api/setDeviceSubscriptions.js'
import { AudinateDanteModule } from './main.js'
import { parseSubscriptionInfoFromOptions, parseSubscriptionVectorInfoFromOptions, ChannelSubscription } from './options.js'
import { RxChannel } from './graphql-codegen/graphql.js'

// Helper function to generate channel option fields dynamically
function generateChannelFields(maxChannels: number): SomeCompanionActionInputField[] {
	const fields: SomeCompanionActionInputField[] = []
	
	for (let i = 1; i <= maxChannels; i++) {
		// RX Channel field with pre-populated default value
		const channelNumber = i.toString().padStart(2, '0') // "01", "02", "03", etc.
		fields.push({
			id: `rxChannel${i}`,
			type: 'textinput',
			label: `RX Channel ${i} Name`,
			default: channelNumber,
			tooltip: 'RX channel name (pre-populated, modify if needed, or leave empty to skip)',
			isVisible: (options) => !!options.rxDevice,
		})
		
		// TX Source field (combined device@channel format)
		fields.push({
			id: `txSource${i}`,
			type: 'textinput',
			label: `  → TX Source ${i}`,
			default: '',
			tooltip: `TX source for channel ${i} in format "DeviceName@ChannelName" (empty to clear subscription)`,
			isVisible: (options) => !!options.rxDevice,
		})
	}
	
	return fields
}

export function generateActions(self: AudinateDanteModule): CompanionActionDefinitions {
	// Debug logging to help diagnose device selection issues
	const deviceCount = self.domain?.devices?.length ?? 0
	const rxChannelCount = self.domain?.devices?.reduce((total, device) => 
		total + (device?.rxChannels?.length ?? 0), 0) ?? 0
	const txChannelCount = self.domain?.devices?.reduce((total, device) => 
		total + (device?.txChannels?.length ?? 0), 0) ?? 0
	
	self.log('debug', `generateActions: ${deviceCount} devices, ${rxChannelCount} RX channels, ${txChannelCount} TX channels`)
	
	// If no devices, log warning
	if (deviceCount === 0) {
		self.log('warn', 'No devices found in domain. Device selectors will be empty.')
	}
	
	const maxChannels = self.config.maxChannelsForDropdowns || 500
	if (rxChannelCount > maxChannels) {
		// Return text-input based actions for large domains to prevent system hangs
		self.log('info', `Using text-input actions for large domain (${rxChannelCount} > ${maxChannels} channels)`)
		return generateTextInputActions(self)
	}
	
	return generateDropdownActions(self)
}

function generateTextInputActions(self: AudinateDanteModule): CompanionActionDefinitions {
	// Bind methods to `self` to prevent `this` scoping issues, satisfying the unbound-method lint rule.
	const checkFeedbacks = self.checkFeedbacks.bind(self)

	return {
		subscribeChannelText: {
			name: 'Subscribe Dante Channel (Text Input)',
			description: 'For large domains - use exact device/channel names instead of dropdowns',
			options: [
				{
					id: 'rxDevice',
					type: 'textinput',
					label: 'RX Device Name',
					default: '',
					tooltip: 'Enter the exact RX device name from your Dante domain',
				},
				{
					id: 'rxChannel',
					type: 'textinput',
					label: 'RX Channel Name',
					default: '',
					tooltip: 'Enter the exact RX channel name (e.g., "1", "Input 1", etc.)',
				},
				{
					id: 'txDevice',
					type: 'textinput',
					label: 'TX Device Name',
					default: '',
					tooltip: 'Enter the exact TX device name, or leave empty to clear subscription',
				},
				{
					id: 'txChannel',
					type: 'textinput',
					label: 'TX Channel Name',
					default: '',
					tooltip: 'Enter the exact TX channel name, or leave empty to clear subscription',
				},
			],
			callback: async (action) => {
				const rxDeviceName = action.options.rxDevice as string
				const rxChannelName = action.options.rxChannel as string
				const txDeviceName = action.options.txDevice as string
				const txChannelName = action.options.txChannel as string

				if (!rxDeviceName || !rxChannelName) {
					self.log('warn', 'RX Device and Channel names are required')
					return
				}

				// Find the RX device and channel
				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice) {
					self.log('error', `RX Device "${rxDeviceName}" not found in domain`)
					return
				}

				const rxChannel = rxDevice.rxChannels?.find(c => c?.name === rxChannelName)
				if (!rxChannel) {
					self.log('error', `RX Channel "${rxChannelName}" not found on device "${rxDeviceName}"`)
					return
				}

				// Build subscription info in the correct format
				const subscriptionInfo: ChannelSubscription = {
					rxChannelIndex: rxChannel.index ?? 0,
					rxDeviceId: rxDevice.id,
					txChannelName: txChannelName || '',
					txDeviceName: txDeviceName || '',
				}

				try {
					await setDeviceSubscriptions(self, subscriptionInfo)
					self.log('info', `Subscription set: ${rxChannelName}@${rxDeviceName} → ${txChannelName}@${txDeviceName}`)
					checkFeedbacks()
				} catch (error) {
					self.log('error', `Failed to set subscription: ${error}`)
				}
			},
		},

		subscribeMultiChannelText: {
			name: 'Subscribe Multiple Dante Channels (Text Input)',
			description: 'For large domains - Use "Auto-Populate Channel Names" action below to get channel names, then copy with Learn Values (supports 128 channels)',
			options: [
				{
					id: 'rxDevice',
					type: 'dropdown',
					label: 'RX Device',
					default: '',
					choices: [
						{ id: '', label: 'Select a device...' },
						...(self.domain?.devices?.map((d) => {
							if (d?.name && d.id) {
								return {
									id: d.name, // Use name for easier text matching
									label: `${d.name} (${d.rxChannels?.length || 0} RX channels)`,
								}
							}
							return undefined
						}).filter((device): device is { id: string; label: string } => device !== undefined) ?? []),
					],
					tooltip: 'Select the RX device to configure',
				},
				// Generate 128 channel fields dynamically
				...generateChannelFields(128),
			],
			callback: async (action) => {
				const rxDeviceName = action.options.rxDevice as string

				if (!rxDeviceName) {
					self.log('warn', 'RX Device name is required')
					return
				}

				// Find the RX device
				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice) {
					self.log('error', `RX Device "${rxDeviceName}" not found in domain`)
					return
				}

				const subscriptions = []

				// Process each channel (1-128)
				for (let i = 1; i <= 128; i++) {
					const rxChannelName = action.options[`rxChannel${i}`] as string
					const txSource = action.options[`txSource${i}`] as string

					if (!rxChannelName?.trim()) continue

					const rxChannel = rxDevice.rxChannels?.find(c => c?.name === rxChannelName.trim())
					if (!rxChannel) {
						self.log('warn', `RX Channel "${rxChannelName.trim()}" not found on device "${rxDeviceName}"`)
						continue
					}

					// Parse TX source in format "DeviceName@ChannelName"
					let txDeviceName = ''
					let txChannelName = ''
					
					if (txSource?.trim()) {
						const parts = txSource.trim().split('@')
						if (parts.length === 2) {
							txDeviceName = parts[0].trim()
							txChannelName = parts[1].trim()
						} else if (parts.length === 1) {
							// If no @ found, treat as device name only
							txDeviceName = parts[0].trim()
						} else {
							self.log('warn', `Invalid TX source format for channel ${i}: "${txSource}". Use "DeviceName@ChannelName"`)
							continue
						}
					}

					subscriptions.push({
						rxChannelIndex: rxChannel.index ?? 0,
						subscribedDevice: txDeviceName || '',
						subscribedChannel: txChannelName || '',
					})
				}

				if (subscriptions.length === 0) {
					self.log('warn', 'No valid channel mappings found')
					return
				}

				// Use the multiple channel subscription API
				const subscriptionOptions = {
					deviceId: rxDevice.id,
					subscriptions,
				}

				try {
					const result = await setMultipleChannelDeviceSubscriptions(self, subscriptionOptions)
					if (result) {
						self.log('info', `Multiple subscriptions set for device "${rxDeviceName}": ${subscriptions.length} channels`)
						checkFeedbacks()
					} else {
						self.log('error', 'Failed to set multiple subscriptions')
					}
				} catch (error) {
					self.log('error', `Failed to set multiple subscriptions: ${error}`)
				}
			},
			learn: (action) => {
				const rxDeviceName = action.options.rxDevice as string
				
				if (!rxDeviceName) {
					return action.options
				}

				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice || !rxDevice.rxChannels) {
					return action.options
				}

				// Generate learned values for each configured channel (1-128)
				const learnedOptions: any = { ...action.options }

				for (let i = 1; i <= 128; i++) {
					const channelNumber = i.toString().padStart(2, '0') // "01", "02", "03", etc.
					let rxChannelName = action.options[`rxChannel${i}`] as string
					
					// If RX channel name is empty, populate with default pattern
					if (!rxChannelName?.trim()) {
						learnedOptions[`rxChannel${i}`] = channelNumber
						rxChannelName = channelNumber
					}

					const rxChannel = rxDevice.rxChannels.find(c => c?.name === rxChannelName.trim())
					if (rxChannel) {
						const txDevice = rxChannel.subscribedDevice || ''
						const txChannel = rxChannel.subscribedChannel || ''
						// Combine into single field format
						if (txDevice && txChannel) {
							learnedOptions[`txSource${i}`] = `${txDevice}@${txChannel}`
						} else if (txDevice) {
							learnedOptions[`txSource${i}`] = txDevice
						} else {
							learnedOptions[`txSource${i}`] = ''
						}
					}
				}

				return learnedOptions
			},
		},

		populateChannelNames: {
			name: 'Auto-Populate Channel Names from Device',
			description: 'Automatically populate RX channel names based on the actual channels found on the selected device',
			options: [
				{
					id: 'rxDevice',
					type: 'dropdown',
					label: 'RX Device',
					default: '',
					choices: [
						{ id: '', label: 'Select a device...' },
						...(self.domain?.devices?.map((d) => {
							if (d?.name && d.id) {
								return {
									id: d.name,
									label: `${d.name} (${d.rxChannels?.length || 0} RX channels)`,
								}
							}
							return undefined
						}).filter((device): device is { id: string; label: string } => device !== undefined) ?? []),
					],
					tooltip: 'Select the RX device to get channel names from',
				},
				{
					id: 'useDeviceNames',
					type: 'checkbox',
					label: 'Use Device Channel Names',
					default: true,
					tooltip: 'If checked, use actual device channel names. If unchecked, use pattern "01", "02", "03"...',
				},
			],
			callback: async (action) => {
				const rxDeviceName = action.options.rxDevice as string
				const useDeviceNames = action.options.useDeviceNames as boolean

				if (!rxDeviceName) {
					self.log('warn', 'Please select an RX Device first')
					return
				}

				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice || !rxDevice.rxChannels) {
					self.log('error', `Device "${rxDeviceName}" not found or has no RX channels`)
					return
				}

				// Log the channel names that would be populated
				if (useDeviceNames) {
					const channelNames = rxDevice.rxChannels.slice(0, 128).map(ch => ch?.name || 'Unknown').join(', ')
					self.log('info', `Device "${rxDeviceName}" has ${rxDevice.rxChannels.length} RX channels. Names: ${channelNames}`)
				} else {
					self.log('info', `Will populate with pattern "01", "02", "03"... up to channel ${Math.min(128, rxDevice.rxChannels.length)}`)
				}
				
				self.log('info', 'Use "Learn Values" below to copy these channel names to the Multiple Channels action')
			},
			learn: (action) => {
				const rxDeviceName = action.options.rxDevice as string
				const useDeviceNames = action.options.useDeviceNames as boolean
				
				if (!rxDeviceName) {
					return action.options
				}

				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice || !rxDevice.rxChannels) {
					return action.options
				}

				// Generate the populated channel names
				const populatedOptions: any = { rxDevice: rxDeviceName }
				
				for (let i = 1; i <= 128; i++) {
					if (useDeviceNames) {
						// Use actual device channel names
						const rxChannel = rxDevice.rxChannels[i - 1]
						if (rxChannel?.name) {
							populatedOptions[`rxChannel${i}`] = rxChannel.name
						} else {
							populatedOptions[`rxChannel${i}`] = ''
						}
					} else {
						// Use pattern "01", "02", "03"...
						if (i <= rxDevice.rxChannels.length) {
							const channelNumber = i.toString().padStart(2, '0')
							populatedOptions[`rxChannel${i}`] = channelNumber
						} else {
							populatedOptions[`rxChannel${i}`] = ''
						}
					}
					populatedOptions[`txSource${i}`] = '' // Keep TX sources empty
				}
				
				return populatedOptions
			},
		},

		subscribeMultiChannelSimple: {
			name: 'Subscribe Multiple Channels (Simple Text)',
			description: 'For large domains - use semicolon-separated channel mappings in a single field',
			options: [
				{
					id: 'rxDevice',
					type: 'dropdown',
					label: 'RX Device',
					default: '',
					choices: [
						{ id: '', label: 'Select a device...' },
						...(self.domain?.devices?.map((d) => {
							if (d?.name && d.id) {
								return {
									id: d.name,
									label: `${d.name} (${d.rxChannels?.length || 0} RX channels)`,
								}
							}
							return undefined
						}).filter((device): device is { id: string; label: string } => device !== undefined) ?? []),
					],
					tooltip: 'Select the RX device to configure',
				},
				{
					id: 'channelMappings',
					type: 'textinput',
					label: 'Channel Mappings',
					default: '',
					tooltip: 'Format: RxCh1=TxCh1@TxDev1; RxCh2=TxCh2@TxDev2; RxCh3= (semicolon separated, empty after = clears)',
					isVisible: (options) => !!options.rxDevice,
				},
			],
			callback: async (action) => {
				const rxDeviceName = action.options.rxDevice as string
				const channelMappings = action.options.channelMappings as string

				if (!rxDeviceName) {
					self.log('warn', 'RX Device name is required')
					return
				}

				if (!channelMappings) {
					self.log('warn', 'Channel mappings are required')
					return
				}

				// Find the RX device
				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice) {
					self.log('error', `RX Device "${rxDeviceName}" not found in domain`)
					return
				}

				// Parse channel mappings (semicolon separated)
				const mappings = channelMappings.split(';').map(s => s.trim()).filter(s => s)
				const subscriptions = []

				for (const mapping of mappings) {
					const [rxChannelName, txMapping] = mapping.split('=')
					if (!rxChannelName?.trim()) continue

					const rxChannel = rxDevice.rxChannels?.find(c => c?.name === rxChannelName.trim())
					if (!rxChannel) {
						self.log('warn', `RX Channel "${rxChannelName.trim()}" not found on device "${rxDeviceName}"`)
						continue
					}

					let txDeviceName = ''
					let txChannelName = ''
					
					if (txMapping?.trim()) {
						const txParts = txMapping.trim().split('@')
						txChannelName = txParts[0] || ''
						txDeviceName = txParts[1] || ''
					}

					subscriptions.push({
						rxChannelIndex: rxChannel.index ?? 0,
						subscribedDevice: txDeviceName,
						subscribedChannel: txChannelName,
					})
				}

				if (subscriptions.length === 0) {
					self.log('warn', 'No valid channel mappings found')
					return
				}

				// Use the multiple channel subscription API
				const subscriptionOptions = {
					deviceId: rxDevice.id,
					subscriptions,
				}

				try {
					const result = await setMultipleChannelDeviceSubscriptions(self, subscriptionOptions)
					if (result) {
						self.log('info', `Multiple subscriptions set for device "${rxDeviceName}": ${subscriptions.length} channels`)
						checkFeedbacks()
					} else {
						self.log('error', 'Failed to set multiple subscriptions')
					}
				} catch (error) {
					self.log('error', `Failed to set multiple subscriptions: ${error}`)
				}
			},
			learn: (action) => {
				const rxDeviceName = action.options.rxDevice as string
				if (!rxDeviceName) {
					return action.options
				}

				const rxDevice = self.domain?.devices?.find(d => d?.name === rxDeviceName)
				if (!rxDevice || !rxDevice.rxChannels) {
					return action.options
				}

				// Generate semicolon-separated mappings from current subscriptions
				const mappings = rxDevice.rxChannels
					.filter(channel => channel?.name)
					.map(channel => {
						const rxChannelName = channel!.name
						const subscribedChannel = channel!.subscribedChannel || ''
						const subscribedDevice = channel!.subscribedDevice || ''
						
						if (subscribedChannel && subscribedDevice) {
							return `${rxChannelName}=${subscribedChannel}@${subscribedDevice}`
						} else {
							return `${rxChannelName}=`
						}
					})
					.join('; ')

				return {
					...action.options,
					channelMappings: mappings,
				}
			},
		},

		listDeviceChannels: {
			name: 'List Device Channels (Helper)',
			description: 'Log available channels for a specific device to help with text input actions',
			options: [
				{
					id: 'deviceName',
					type: 'dropdown',
					label: 'Device',
					default: '',
					choices: [
						{ id: '', label: 'Select a device...' },
						...(self.domain?.devices?.map((d) => {
							if (d?.name && d.id) {
								return {
									id: d.name,
									label: `${d.name} (${d.rxChannels?.length || 0} RX, ${d.txChannels?.length || 0} TX)`,
								}
							}
							return undefined
						}).filter((device): device is { id: string; label: string } => device !== undefined) ?? []),
					],
					tooltip: 'Select a device to list its available channels',
				},
			],
			callback: async (action) => {
				const deviceName = action.options.deviceName as string
				if (!deviceName) {
					self.log('warn', 'Please select a device')
					return
				}

				const device = self.domain?.devices?.find(d => d?.name === deviceName)
				if (!device) {
					self.log('error', `Device "${deviceName}" not found`)
					return
				}

				self.log('info', `=== Device: ${deviceName} ===`)
				
				if (device.rxChannels && device.rxChannels.length > 0) {
					self.log('info', `RX Channels (${device.rxChannels.length}):`)
					device.rxChannels.forEach((channel, index) => {
						if (channel) {
							const subscription = channel.subscribedDevice && channel.subscribedChannel 
								? ` → ${channel.subscribedChannel}@${channel.subscribedDevice}`
								: ' (unsubscribed)'
							self.log('info', `  ${index + 1}. "${channel.name}"${subscription}`)
						}
					})
				} else {
					self.log('info', 'No RX channels found')
				}

				if (device.txChannels && device.txChannels.length > 0) {
					self.log('info', `TX Channels (${device.txChannels.length}):`)
					device.txChannels.forEach((channel, index) => {
						if (channel) {
							self.log('info', `  ${index + 1}. "${channel.name}"`)
						}
					})
				} else {
					self.log('info', 'No TX channels found')
				}

				self.log('info', `=== End Device: ${deviceName} ===`)
			},
		},
		forceFullFetch: {
			name: 'Force Full Fetch',
			description: 'Immediately refresh all domain data and check feedbacks (useful after making subscriptions)',
			options: [],
			callback: async () => {
				self.log('info', 'Force Full Fetch action triggered')
				await self.forceFullFetch()
			},
		},
	}
}

function generateDropdownActions(self: AudinateDanteModule): CompanionActionDefinitions {
	// Bind methods to `self` to prevent `this` scoping issues, satisfying the unbound-method lint rule.
	const setVariableValues = self.setVariableValues.bind(self)
	const checkFeedbacks = self.checkFeedbacks.bind(self)

	const availableRxChannels = self.domain?.devices?.flatMap((d) => {
		if (!d || !d.rxChannels || d.rxChannels.length === 0) {
			return []
		}
		return d.rxChannels.map((rxChannel) => {
			if (!rxChannel || rxChannel.index === undefined || !rxChannel.name) {
				return null
			}
			return {
				id: `${rxChannel.index}@${d.id}`,
				label: `${rxChannel.name}@${d.name}`,
			}
		}).filter(channel => channel !== null)
	}) ?? []

	// Debug logging for RX channels
	self.log('debug', `Available RX channels: ${JSON.stringify(availableRxChannels?.slice(0, 5))} (showing first 5)`)
	self.log('debug', `Total RX channels for dropdown: ${availableRxChannels?.length ?? 0}`)

	// Build TX channels for debugging  
	const availableTxChannels = self.domain?.devices
		?.flatMap((d) => {
			if (!d || !d.txChannels || d.txChannels.length === 0) {
				return []
			}
			return d.txChannels.map((txChannel) => {
				if (!txChannel || !txChannel.name) {
					return null
				}
				return {
					id: `${txChannel.name}@${d.name}`,
					label: `${txChannel.name}@${d.name}`,
				}
			}).filter(channel => channel !== null)
		}) ?? []

	self.log('debug', `Available TX channels: ${JSON.stringify(availableTxChannels?.slice(0, 5))} (showing first 5)`)
	self.log('debug', `Total TX channels for dropdown: ${availableTxChannels?.length ?? 0}`)

	const variableSelector = [1, 2, 3, 4].map((s) => ({
		id: `rx-selector-${s}`,
		label: `Selector #${s}`,
	}))

	const buildSubscriptionDropdown = (rxChannel: RxChannel): SomeCompanionActionInputField | undefined => {
		if (!rxChannel) {
			return undefined
		}
		return <SomeCompanionActionInputField>{
			id: `rxDeviceChannel-${rxChannel.id}`,
			type: 'dropdown',
			label: `${rxChannel.index}: ${rxChannel.name}`,
			default: 'ignore',
			choices: [
				{
					id: 'clear',
					label: 'Clear',
				},
				{
					id: 'ignore',
					label: 'Ignore',
				},
				...(self.domain?.devices
					?.flatMap((d) => {
						return d?.txChannels?.map((txChannel) => {
							if (txChannel && d) {
								return {
									id: `${txChannel.name}@${d.name}`,
									label: `${txChannel.name}@${d.name}`,
								}
							}
							return null
						})
					})
					.filter((channel): channel is { id: string; label: string } => channel !== undefined) ?? []),
			],
		}
	}

	const optionsGenerator = (): SomeCompanionActionInputField[] => {
		return (
			self.domain?.devices
				?.flatMap((d) => {
					if (!d || !d.rxChannels) {
						return undefined
					}
					return d.rxChannels.map((rxChannel) => {
						if (!rxChannel) {
							return undefined
						}
						const deviceId = d.id
						return <SomeCompanionActionInputField>{
							...buildSubscriptionDropdown(rxChannel),
							isVisible: (o, data) => {
								return o['rxDevice']?.valueOf() === data.deviceId
							},
							isVisibleData: { deviceId },
						}
					})
				})
				.filter((device) => device !== undefined) ?? []
		)
	}

	return {
		subscribeChannel: {
			name: 'Subscribe Dante Channel',
			options: [
				{
					id: 'rx',
					type: 'dropdown',
					label: 'Rx Channel@Device',
					default: 'Select a receive channel',
					choices: availableRxChannels?.filter((channel) => channel !== undefined) ?? [],
					allowCustom: true,
					tooltip: 'The receiving channel to set the subscription on',
					isVisible: (o) => {
						return o['useSelector']?.valueOf() === false
					},
				},
				{
					id: 'rxSelector',
					type: 'dropdown',
					label: 'Rx Selector',
					default: 'rx-selector-1',
					choices: variableSelector,
					tooltip: 'Use in combination with "set destination" actions',
					isVisible: (o) => {
						return o['useSelector']?.valueOf() === true
					},
				},
				{
					id: 'useSelector',
					type: 'checkbox',
					label: 'Use Rx Selector',
					default: false,
					tooltip: 'Use in combination with "set destination" actions',
				},
				{
					id: 'tx',
					type: 'dropdown',
					label: 'Tx Channel@Device',
					default: 'Select a transmit channel',
					choices: availableTxChannels,
					allowCustom: true,
					tooltip: 'The transmitting device to subscribe to',
				},
			],
			callback: async (action) => {
				const subscriptionOptions = parseSubscriptionInfoFromOptions(self, action.options)
				if (!subscriptionOptions) {
					console.error(`subscription options not parsed, so not applying any subscription`)
					return
				}

				const { rxChannelIndex, rxDeviceId, txChannelName, txDeviceName } = subscriptionOptions || {}

				self.log(
					'info',
					`subscribing channel ${rxChannelIndex} on device ${rxDeviceId} to channel ${txChannelName} on device ${txDeviceName}`,
				)

				const result = await setDeviceSubscriptions(self, subscriptionOptions)

				if (!result) {
					self.log('error', `subscribeChannel failed`)
					return
				}

				self.log('info', `subscribeMultiChannel result: ${JSON.stringify(result.data, null, 2)}`)
			},
		},

		subscribeMultiChannel: {
			name: 'Subscribe Multiple Dante Channel',
			description:
				'From the drop down, select an Rx device, then make the required selections for each Rx channels with the dropdowns. Note: select "clear" to clear out the subscription and "Ignore" to not make any changes to the specific Rx channel. Select "Learn" to load latest state from the device',
			options: [
				{
					id: 'rxDevice',
					type: 'dropdown',
					label: 'Rx Device',
					default: ``,
					choices:
						self.domain?.devices
							?.map((d) => {
								if (d?.name && d.id) {
									return {
										id: d.id,
										label: d.name,
									}
								}
								return undefined
							})
							.filter((channel): channel is { id: string; label: string } => channel !== undefined) ?? [],
					allowCustom: true,
					tooltip: 'The receiving device to set the subscriptions on',
				},
				{
					id: 'rxChannelsHeader',
					label: 'Rx Channels',
					tooltip: 'The available RX channels of the selected device',
					type: 'static-text',
					value: '',
				},
				...optionsGenerator(),
			],
			callback: async (action) => {
				const subscriptionOptions = parseSubscriptionVectorInfoFromOptions(action.options)

				if (!subscriptionOptions) {
					console.error(`subscription options not parsed, so not applying any subscription`)
					return
				}

				for (const subscriptionObj of subscriptionOptions.subscriptions) {
					self.log(
						'debug',
						`subscribing channel ${subscriptionObj.rxChannelIndex} on device ${subscriptionOptions.deviceId} to channel ${subscriptionObj.subscribedChannel} on device ${subscriptionObj.subscribedDevice}`,
					)
				}
				const result = await setMultipleChannelDeviceSubscriptions(self, subscriptionOptions)

				if (!result) {
					self.log('error', `subscribeMultiChannel failed`)
					return
				}

				self.log('info', `subscribeMultiChannel result: ${JSON.stringify(result.data, null, 2)}`)
			},
			learn: (action) => {
				const { rxDevice } = action.options
				if (!rxDevice) {
					return undefined
				}

				const currentRxDevice = self.domain?.devices?.find((d) => d?.id === action.options.rxDevice)
				if (!currentRxDevice) {
					return action.options // Return original options if device not found
				}
				const optionsSubset: any = {}
				const keyPrefix = 'rxDeviceChannel-'

				// Iterate over the action's options to find the ones we need to update
				Object.entries(action.options).forEach(([key, _value]) => {
					if (typeof key !== 'string' || !key.startsWith(keyPrefix)) {
						return // Skip options that aren't for an Rx channel
					}

					// Extract the channel ID from the option key (e.g., 'd1-rx1')
					const rxChannelId = key.substring(keyPrefix.length)
					const targetChannel = currentRxDevice.rxChannels?.find((ch) => ch!.id === rxChannelId)

					if (targetChannel) {
						const { subscribedChannel, subscribedDevice } = targetChannel
						if (subscribedChannel && subscribedDevice) {
							// If subscribed, set the value to 'channel@device'
							optionsSubset[key] = `${subscribedChannel}@${subscribedDevice}`
						} else {
							// If not subscribed, set the value to 'clear'
							optionsSubset[key] = 'clear'
						}
					}
				})

				// Return the original options merged with our learned values
				return {
					...action.options,
					...optionsSubset,
				}
			},
		},

		setDestinationChannel: {
			name: 'Set Destination',
			options: [
				{
					id: 'rxSelector',
					type: 'dropdown',
					label: 'Rx Selector',
					default: 'rx-selector-1',
					choices: variableSelector,
					tooltip: 'The selector to set',
				},
				{
					id: 'rx',
					type: 'dropdown',
					label: 'Rx Channel@Device',
					default: 'Select a receive channel',
					choices:
						self.domain?.devices
							?.flatMap((d) => {
								return d?.rxChannels?.map((rxChannel) => ({
									id: `${rxChannel?.index}@${d.id}`,
									label: `${rxChannel?.name}@${d.name}`,
								}))
							})
							.filter((channel): channel is { id: string; label: string } => channel !== undefined) ?? [],
					allowCustom: true,
					tooltip: 'The receiving channel to set the subscription on',
				},
			],
			callback: async (action) => {
				const { rx, rxSelector } = action.options
				if (rxSelector) {
					if (rx) {
						self.variables[rxSelector.toString()] = rx.toString()
						self.log('info', `set variable ${rxSelector.toString()} to ${rx.toString()}`)
						setVariableValues(self.variables)
						checkFeedbacks()
					} else {
						self.log('error', 'rx is undefined')
					}
				} else {
					self.log('error', 'rxSelector is undefined')
				}
			},
		},
		forceFullFetch: {
			name: 'Force Full Fetch',
			description: 'Immediately refresh all domain data and check feedbacks (useful after making subscriptions)',
			options: [],
			callback: async () => {
				self.log('info', 'Force Full Fetch action triggered')
				await self.forceFullFetch()
			},
		},
	}
}

export default generateActions
