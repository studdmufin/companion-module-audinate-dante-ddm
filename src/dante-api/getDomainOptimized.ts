import { InstanceStatus } from '@companion-module/base'

// eslint-disable-next-line n/no-missing-import
import { ApolloClient, gql } from '@apollo/client/core/index.js'
// eslint-disable-next-line n/no-missing-import
import { NormalizedCacheObject } from '@apollo/client/cache/index.js'

import { DomainQuery } from '../graphql-codegen/graphql.js'
import { AudinateDanteModule } from '../main.js'

// Same query as original but with optimized caching strategy
export const domainQueryOptimized = gql`
	query Domain($domainIDInput: ID!) {
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
				txChannels {
					id
					index
					name
				}
			}
		}
	}
`

export async function getDomainOptimized(
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
			query: domainQueryOptimized,
			variables: { domainIDInput: domainId },
			// Use network-first for full refreshes, cache-first for frequent polls
			fetchPolicy: useNetworkFirst ? 'network-only' : 'cache-first',
			// Add error policy to handle partial failures gracefully
			errorPolicy: 'all',
		})

		return result.data.domain
	} catch (e) {
		if (e instanceof Error) {
			self.log('error', `getDomainOptimized for ${domainId}: ${e.message}`)
			self.log('debug', JSON.stringify(e, null, 2))
			self.updateStatus(InstanceStatus.Disconnected, e.message)
		}
		return
	}
}
