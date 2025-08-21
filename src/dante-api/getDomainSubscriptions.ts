import { InstanceStatus } from '@companion-module/base'

// eslint-disable-next-line n/no-missing-import
import { ApolloClient, gql } from '@apollo/client/core/index.js'
// eslint-disable-next-line n/no-missing-import
import { NormalizedCacheObject } from '@apollo/client/cache/index.js'

import { DomainQuery } from '../graphql-codegen/graphql.js'
import { AudinateDanteModule } from '../main.js'

// Lightweight query that fetches only RX channel subscription state (no txChannels)
export const domainSubscriptionsQuery = gql`
	query DomainSubscriptions($domainIDInput: ID!) {
		domain(id: $domainIDInput) {
			id
			name
			devices {
				id
				name
				rxChannels {
					id
					index
					name
					subscribedDevice
					subscribedChannel
					status
					summary
				}
			}
		}
	}
`

export async function getDomainSubscriptions(
	self: AudinateDanteModule,
	useNetworkFirst = true,
): Promise<DomainQuery['domain']> {
	const domainId: string = self.config.domainID
	try {
		const apolloClient: ApolloClient<NormalizedCacheObject> | undefined = self.apolloClient
		if (!apolloClient) {
			throw new Error('ApolloClient is not initialized')
		}

		const result = await apolloClient.query<DomainQuery>({
			query: domainSubscriptionsQuery,
			variables: { domainIDInput: domainId },
			// For polling subscription state we usually want fresh data
			fetchPolicy: useNetworkFirst ? 'network-only' : 'cache-first',
			errorPolicy: 'all',
		})

		return result.data.domain
	} catch (e) {
		if (e instanceof Error) {
			self.log('error', `getDomainSubscriptions for ${domainId}: ${e.message}`)
			self.log('debug', JSON.stringify(e, null, 2))
			self.updateStatus(InstanceStatus.Disconnected, e.message)
		}
		return
	}
}
