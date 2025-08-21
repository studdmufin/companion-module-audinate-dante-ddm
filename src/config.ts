export type ConfigType = {
	apihost: string
	apikey: string
	domainID: string
	disableCertificateValidation: boolean
	pollInterval?: number
	maxChannelsForDropdowns?: number
	fullFetchInterval?: number
	// Bulk multi-channel apply tunables
	pausePollingOnBulkApply?: boolean
	bulkBatchSize?: number
	bulkRetries?: number
	bulkBatchDelayMs?: number
	bulkRetryDelayMs?: number
}
