import { InstanceStatus } from '@companion-module/base'

// eslint-disable-next-line n/no-missing-import
import { ApolloClient, gql } from '@apollo/client/core/index.js'
// eslint-disable-next-line n/no-missing-import
import { NormalizedCacheObject } from '@apollo/client/cache/index.js'

import { DomainQuery } from '../graphql-codegen/graphql.js'
import { AudinateDanteModule } from '../main.js'

export const domainQuery = gql`
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

export type DomainFetchPolicy = 'network-only' | 'cache-first' | 'no-cache'

export async function getDomain(
	self: AudinateDanteModule,
	options?: { policy?: DomainFetchPolicy; errorPolicy?: 'all' | 'none' },
): Promise<DomainQuery['domain']> {
	const domainId: string = self.config.domainID
	try {
		const apolloClient: ApolloClient<NormalizedCacheObject> | undefined = self.apolloClient
		if (!apolloClient) {
			throw new Error('ApolloClient is not initialized')
		}

		// Build query options, allowing overrides of fetch and error policy.
		const queryOptions: any = {
			query: domainQuery,
			variables: { domainIDInput: domainId },
		}
		if (options?.policy) {
			queryOptions.fetchPolicy = options.policy
		}
		if (options?.errorPolicy) {
			queryOptions.errorPolicy = options.errorPolicy
		}

		const result = await apolloClient.query<DomainQuery>(queryOptions)

		return result.data.domain
	} catch (e) {
		if (e instanceof Error) {
			self.log('error', `getDomain for ${domainId}: ${e.message}`)
			self.log('debug', JSON.stringify(e, null, 2))
			self.updateStatus(InstanceStatus.Disconnected, e.message)
		}
		return
	}
}
