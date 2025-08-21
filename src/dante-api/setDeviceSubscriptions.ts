// eslint-disable-next-line n/no-missing-import
import { FetchResult, gql } from '@apollo/client/core/index.js'
import {
	DeviceRxChannelsSubscriptionSetMutation,
	DeviceRxChannelsSubscriptionSetMutationVariables,
	DomainQuery,
} from '../graphql-codegen/graphql.js'
import { AudinateDanteModule } from '../main.js'
import { ChannelSubscription, MultipleChannelSubscription } from '../options.js'
import { domainSubscriptionsQuery } from './getDomainSubscriptions.js'
import { getDomainSubscriptions as fetchDomainSubscriptions } from './getDomainSubscriptions.js'

export const DeviceRxChannelsSubscriptionSet = gql`
	mutation DeviceRxChannelsSubscriptionSet($input: DeviceRxChannelsSubscriptionSetInput!) {
		DeviceRxChannelsSubscriptionSet(input: $input) {
			ok
		}
	}
`

export async function setDeviceSubscriptions(
	self: AudinateDanteModule,
	subscription: ChannelSubscription,
): Promise<FetchResult<DeviceRxChannelsSubscriptionSetMutation> | undefined> {
	try {
		if (!self.apolloClient) {
			self.log('error', 'Apollo Client is not initialized')
			return
		}
		const result = await self.apolloClient.mutate<
			DeviceRxChannelsSubscriptionSetMutation,
			DeviceRxChannelsSubscriptionSetMutationVariables
		>({
			mutation: DeviceRxChannelsSubscriptionSet,
			variables: {
				input: {
					deviceId: subscription.rxDeviceId,
					subscriptions: [
						{
							rxChannelIndex: Number(subscription.rxChannelIndex),
							subscribedDevice: subscription.txDeviceName,
							subscribedChannel: subscription.txChannelName,
						},
					],
				},
			},
			// Provide an optimistic UI update
			optimisticResponse: {
				DeviceRxChannelsSubscriptionSet: {
					ok: true,
				},
			},
			// Update the cached DomainSubscriptions query so UI reflects the change immediately
			update: (cache) => {
				try {
					const cached = cache.readQuery<DomainQuery>({
						query: domainSubscriptionsQuery,
						variables: { domainIDInput: self.config.domainID },
					})
					if (!cached || !cached.domain) return

					// Deep clone the cached domain to modify
					const cachedDomain = cached.domain
					if (!cachedDomain) return

					const newDomain = JSON.parse(JSON.stringify(cachedDomain)) as DomainQuery['domain']
					if (!newDomain || !newDomain.devices) return

					const device = newDomain.devices.find((d) => d && d.id === subscription.rxDeviceId)
					if (!device || !device.rxChannels) return

					// Apply subscription changes
					for (const sub of [subscription]) {
						const idx = Number(sub.rxChannelIndex)
						const rx = device.rxChannels.find((c) => c && c.index === idx)
						if (rx) {
							rx.subscribedDevice = sub.txDeviceName || ''
							rx.subscribedChannel = sub.txChannelName || ''
						}
					}

					cache.writeQuery({
						query: domainSubscriptionsQuery,
						variables: { domainIDInput: self.config.domainID },
						data: { domain: newDomain },
					})
				} catch (e) {
					self.log('debug', `Cache update failed in setDeviceSubscriptions: ${e}`)
				}
			},
			// Ensure server-confirmed subscription state is fetched after mutation completes
			refetchQueries: [
				{
					query: domainSubscriptionsQuery,
					variables: { domainIDInput: self.config.domainID },
				},
			],
		})

		self.log(
			'debug',
			`setDeviceSubscription returned successfully for RX = ${subscription.rxChannelIndex} and TX =${subscription.txChannelName}`,
		)
		return result
	} catch (e) {
		if (e instanceof Error) {
			self.log('error', `setDeviceSubscriptions for ${subscription.rxDeviceId}: ${e.message}`)
		}
		return
	}
}

export async function setMultipleChannelDeviceSubscriptions(
	self: AudinateDanteModule,
	subscription: MultipleChannelSubscription,
): Promise<FetchResult<DeviceRxChannelsSubscriptionSetMutation> | undefined> {
	try {
		if (!self.apolloClient) {
			self.log('error', 'Apollo Client is not initialized')
			return
		}
		const result = await self.apolloClient.mutate<
			DeviceRxChannelsSubscriptionSetMutation,
			DeviceRxChannelsSubscriptionSetMutationVariables
		>({
			mutation: DeviceRxChannelsSubscriptionSet,
			variables: {
				input: {
					deviceId: subscription.deviceId,
					subscriptions: subscription.subscriptions,
				},
			},
			optimisticResponse: {
				DeviceRxChannelsSubscriptionSet: {
					ok: true,
				},
			},
			update: (cache) => {
				try {
					const cached = cache.readQuery<DomainQuery>({
						query: domainSubscriptionsQuery,
						variables: { domainIDInput: self.config.domainID },
					})
					if (!cached || !cached.domain) return

					const newDomain = JSON.parse(JSON.stringify(cached.domain)) as DomainQuery['domain']
					if (!newDomain || !newDomain.devices) return

					const device = newDomain.devices.find((d) => d && d.id === subscription.deviceId)
					if (!device || !device.rxChannels) return

					for (const sub of subscription.subscriptions) {
						const idx = Number(sub.rxChannelIndex)
						const rx = device.rxChannels.find((c) => c && c.index === idx)
						if (rx) {
							rx.subscribedDevice = sub.subscribedDevice || ''
							rx.subscribedChannel = sub.subscribedChannel || ''
						}
					}

					cache.writeQuery({
						query: domainSubscriptionsQuery,
						variables: { domainIDInput: self.config.domainID },
						data: { domain: newDomain },
					})
				} catch (e) {
					self.log('debug', `Cache update failed in setMultipleChannelDeviceSubscriptions: ${e}`)
				}
			},
			// Ensure server-confirmed subscription state is fetched after mutation completes
			refetchQueries: [
				{
					query: domainSubscriptionsQuery,
					variables: { domainIDInput: self.config.domainID },
				},
			],
		})

		self.log(
			'debug',
			`setMultipleChannelDeviceSubscriptions returned successfully for multi-channel subscription for ${subscription.deviceId}`,
		)
		return result
	} catch (e) {
		if (e instanceof Error) {
			self.log('error', `setMultipleChannelDeviceSubscriptions for ${subscription.deviceId}: ${e.message}`)
		}
		return
	}
}

// Utility: sleep for ms
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper to chunk an array
function chunk<T>(arr: T[], size: number): T[][] {
	const res: T[][] = []
	for (let i = 0; i < arr.length; i += size) {
		res.push(arr.slice(i, i + size))
	}
	return res
}

export interface RetryOptions {
	batchSize?: number
	retries?: number
	batchDelayMs?: number
	retryDelayMs?: number
}

// More robust multi-channel subscription that chunks requests, verifies, and retries missing ones
export async function setMultipleChannelDeviceSubscriptionsWithRetry(
	self: AudinateDanteModule,
	subscription: MultipleChannelSubscription,
	options: RetryOptions = {},
): Promise<boolean> {
	const batchSize = options.batchSize ?? 10
	const retries = options.retries ?? 2
	const batchDelayMs = options.batchDelayMs ?? 75
	const retryDelayMs = options.retryDelayMs ?? 250

	let pending = [...subscription.subscriptions]

	for (let attempt = 0; attempt <= retries; attempt++) {
		const batches = chunk(pending, Math.max(1, batchSize))
		self.log('debug', `Applying ${pending.length} subscriptions in ${batches.length} batch(es), attempt ${attempt + 1}`)
		for (const subs of batches) {
			await setMultipleChannelDeviceSubscriptions(self, {
				deviceId: subscription.deviceId,
				subscriptions: subs,
			})
			if (batchDelayMs > 0) await sleep(batchDelayMs)
		}

		// Verify
		try {
			const domain = await fetchDomainSubscriptions(self, true)
			const dev = domain?.devices?.find((d) => d?.id === subscription.deviceId)
			if (!dev?.rxChannels) {
				self.log('warn', `Verification skipped: device ${subscription.deviceId} not found after mutation`)
				return false
			}
			const missing = pending.filter((sub) => {
				const rx = dev.rxChannels?.find((c) => c && c.index === Number(sub.rxChannelIndex))
				if (!rx) return true
				const wantDev = sub.subscribedDevice || ''
				const wantCh = sub.subscribedChannel || ''
				const gotDev = rx.subscribedDevice || ''
				const gotCh = rx.subscribedChannel || ''
				return wantDev !== gotDev || wantCh !== gotCh
			})

			if (missing.length === 0) {
				self.log('info', `All ${subscription.subscriptions.length} subscriptions verified for device ${subscription.deviceId}`)
				return true
			}

			self.log('warn', `Verification found ${missing.length} missing/incorrect subscriptions; will retry if attempts remain`)
			pending = missing
		} catch (e) {
			self.log('debug', `Verification failed: ${e}`)
		}

		if (attempt < retries && retryDelayMs > 0) await sleep(retryDelayMs)
	}

	self.log('error', `Failed to apply all subscriptions after ${retries + 1} attempt(s); ${pending.length} remain`)
	return false
}
