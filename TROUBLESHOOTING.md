# Troubleshooting Guide

## Empty Device Selectors Issue

If the Rx/Tx device selectors appear empty when programming actions in Bitfocus Companion, follow these debugging steps:

### 1. Check Module Configuration

Ensure the module is properly configured:

- **API Host URL**: Should point to your Dante Domain Manager (e.g., `https://api.director.dante.cloud:443/graphql`)
- **API Key**: Valid API key for your Dante Domain Manager
- **Domain**: A specific domain must be selected (not "default")

### 2. Check Module Status

In Companion:

1. Go to the Connections tab
2. Find your Audinate Dante DDM module
3. Check the status indicator:
   - **Green**: Connected and working properly
   - **Yellow**: Connecting or minor issues
   - **Red**: Configuration or connection issues

### 3. Enable Debug Logging

1. In Companion, go to Settings > Logs
2. Set log level to "Debug"
3. Look for debug messages from the Dante module

Expected debug messages when working properly:

```
Domain loaded: X devices, Y RX channels, Z TX channels
First device: [Device Name] (ID: [Device ID]) - RX: X, TX: Y
Available RX channels: [{"id":"0@device1","label":"1@Device1"},...] (showing first 5)
Total RX channels for dropdown: X
Available TX channels: [{"id":"1@device1","label":"1@Device1"},...] (showing first 5)
Total TX channels for dropdown: X
```

### 4. Common Issues and Solutions

#### No Devices Found

**Symptoms**: Debug logs show "0 devices"
**Causes**:

- Wrong domain selected
- Domain has no devices
- API connection issues

**Solutions**:

1. Verify domain selection in module config
2. Check that devices exist in the selected domain via Dante Domain Manager web interface
3. Test API connectivity with curl:
   ```bash
   curl -X POST [API_HOST] \
     -H "Authorization: Bearer [API_KEY]" \
     -H "Content-Type: application/json" \
     -d '{"query":"{ domains { id name } }"}'
   ```

#### Large Domain Performance

**Symptoms**: Debug logs show "Using text-input actions for large domain"
**Causes**: Domain has more than 500 RX channels (configurable)

**Solutions**:

1. Use text-input based actions instead of dropdowns
2. Increase `maxChannelsForDropdowns` in config if your system can handle it
3. Consider domain segmentation

#### Devices Found But No Channels

**Symptoms**: Debug logs show devices but 0 RX/TX channels
**Causes**:

- Devices not properly configured in Dante Domain Manager
- GraphQL query not returning channel data

**Solutions**:

1. Check device configuration in Dante Domain Manager
2. Verify devices have Rx/Tx channels configured
3. Check GraphQL query results in debug logs

#### Connection Issues

**Symptoms**: Red status indicator, connection errors in logs
**Causes**:

- Invalid API credentials
- Network connectivity issues
- Firewall blocking requests

**Solutions**:

1. Verify API key is correct and has proper permissions
2. Test network connectivity to API host
3. Check firewall rules
4. Try disabling certificate validation temporarily (for testing only)

### 5. Module Configuration Parameters

Available configuration options:

- `apihost`: Dante Domain Manager GraphQL endpoint
- `apikey`: API authentication key
- `domainID`: Specific domain to connect to
- `pollInterval`: How often to refresh domain data (default: 5000ms)
- `maxChannelsForDropdowns`: Max channels before switching to text input (default: 500)
- `disableCertificateValidation`: Skip SSL certificate validation (testing only)

### 6. Manual Testing

You can test the GraphQL API directly:

```bash
# List available domains
curl -X POST https://api.director.dante.cloud:443/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ domains { id name } }"}'

# Get domain details with devices
curl -X POST https://api.director.dante.cloud:443/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ domain(id: \"YOUR_DOMAIN_ID\") { id name devices { id name rxChannels { id index name } txChannels { id index name } } } }"}'
```

### 7. Getting Help

If the issue persists:

1. Enable debug logging and capture relevant log messages
2. Note your module configuration (without API key)
3. Document any error messages
4. Check the Issues section of the GitHub repository
5. Provide system information (Companion version, OS, etc.)

### 8. Performance Optimization

For large domains:

- Increase `pollInterval` to reduce API load
- Use text-input actions instead of dropdowns
- Consider domain segmentation if possible
- Monitor system resource usage
