# Large Domain Usage Guide

This module automatically detects when you're connected to a large Dante domain (more than 500 RX channels by default) and switches to text-input mode to prevent performance issues and system hangs.

## Text Input Mode

When connected to a large domain, instead of dropdown menus with hundreds or thousands of options, you'll see text input fields where you need to enter exact device and channel names.

### How to Find Device and Channel Names

1. **From Dante Controller**: Open Dante Controller and look at the device list and channel names
2. **From DDM Web Interface**: Log into your DDM web interface and browse the device list
3. **From Network Audio View**: Use the network audio routing view to see all devices and channels

### Action: "Subscribe Dante Channel (Text Input)"

This action appears when you're connected to large domains. Fill in these fields:

- **RX Device Name**: The exact name of the receiving device (e.g., "Console-Main", "StageMix-01")
- **RX Channel Name**: The exact name of the RX channel (e.g., "1", "Input 1", "Mic 1")
- **TX Device Name**: The exact name of the transmitting device (leave empty to clear subscription)
- **TX Channel Name**: The exact name of the TX channel (leave empty to clear subscription)

### Examples

**Subscribe a channel:**
- RX Device Name: `Console-Main`
- RX Channel Name: `1`
- TX Device Name: `StageMix-01`
- TX Channel Name: `Output 1`

**Clear a subscription:**
- RX Device Name: `Console-Main`
- RX Channel Name: `1`
- TX Device Name: _(leave empty)_
- TX Channel Name: _(leave empty)_

### Feedback: Text Input Mode

Feedbacks also switch to text input mode for large domains. When setting up feedbacks like "RX Channel is Subscribed", you'll need to enter:

- **Device Name**: The exact RX device name
- **Channel Name**: The exact RX channel name

### Tips for Large Domains

1. **Be Precise**: Device and channel names must match exactly (case-sensitive)
2. **Use Copy/Paste**: Copy names from Dante Controller or DDM to avoid typos
3. **Start Small**: Test with a few channels first to verify your naming is correct
4. **Check Logs**: The module logs success/error messages for each subscription attempt

### Adjusting the Threshold

You can change when text input mode activates by modifying the `maxChannelsForDropdowns` config option. The default is 500 channels.

### Performance Notes

- Large domains (1000+ channels) can take 30-60 seconds to fully load
- The module uses smart caching to reduce API calls after initial load
- Text input mode prevents the UI from hanging during dropdown generation
- Domain data is refreshed every 10 polls to stay current
