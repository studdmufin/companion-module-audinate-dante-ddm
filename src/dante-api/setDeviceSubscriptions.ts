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
