# Enhanced Large Domain Features

## New Actions for Large Domains (1000+ Channels)

When your Dante domain exceeds the `maxChannelsForDropdowns` limit (default: 500), the module now provides enhanced text-input based actions that solve the limitations you mentioned:

### 1. Subscribe Multiple Dante Channels (Text Input) ✨
**Addresses your need for multiple channel subscription in large domains**

**Two approaches available:**

#### A) Individual Channel Fields (Recommended) ✅ FIXED
- **Device dropdown**: Select RX device first
- **8 channel groups**: Shows 8 sets of RX/TX fields (use only what you need)
- **Simple workflow**: Fill in RX channel names, then TX device/channel names
- **All fields visible**: No confusing dynamic field behavior
- **Learn values button**: ✅ Reads current subscriptions for all configured channels

**How it works:**
1. Select RX device from dropdown
2. Channel fields 1-8 appear automatically 
3. Fill in RX channel names for the channels you want to configure
4. Fill in corresponding TX device/channel names (leave empty to clear)
5. Click "Learn" to populate TX fields with current subscriptions
6. Empty RX channel fields are ignored

#### B) Simple Text Format (Alternative)
- **Device dropdown**: Select RX device first  
- **Single text field**: Enter multiple mappings separated by semicolons
- **Learn values button**: ✅ Generates the text format from current subscriptions

**Format:**
```
Ch1=Audio1@MixingDesk; Ch2=Audio2@MixingDesk; Ch3=; Ch4=Talkback@TalkbackUnit
```

**Examples:**
```
1=Input1@Mixer; 2=Input2@Mixer; 3=; 4=Monitor@MonitorDeck
Input-L=Music-L@Playout; Input-R=Music-R@Playout; Talkback=TB@Studio
```

### 2. Device Channel Selector (Smart Load) ✨
**Addresses your need for device-specific channel loading**

- **Device-first selection**: Select a device from dropdown first
- **Text input for channels**: After selecting device, use text input for channel names
- **No massive dropdowns**: Avoids loading 1000+ channels in dropdowns
- **Learn button**: ✅ YES! Includes a "Learn" button to read current subscription for that specific channel

**Workflow:**
1. Select RX device from dropdown (shows channel counts)
2. Enter RX channel name in text field
3. Enter TX device and channel names (or leave empty to clear)
4. Use "Learn" to see current subscription for that RX channel

### 3. List Device Channels (Helper) 🔧
**Solves the "what channels are available?" problem**

- **Channel discovery**: Lists all RX and TX channels for a selected device
- **Current subscriptions**: Shows what each RX channel is currently subscribed to
- **Copy-friendly format**: Outputs channel names in quotes for easy copy/paste

**Example Output:**
```
=== Device: StudioMixer ===
RX Channels (24):
  1. "Input-1" → Audio1@SourceDevice
  2. "Input-2" (unsubscribed)
  3. "Input-3" → Music@PlayoutSystem
  ...
TX Channels (24):
  1. "Output-1"
  2. "Output-2"
  ...
=== End Device: StudioMixer ===
```

## How These Solve Your Problems

### ✅ Multiple Channels in Large Domains
**Problem**: Text input only allowed one subscription per action
**Solution**: "Subscribe Multiple Dante Channels (Text Input)" handles many channels at once

### ✅ Learn Values with Text Input  
**Problem**: Learn button only worked with dropdowns
**Solution**: All new text-input actions include learn functionality

### ✅ Device-Specific Channel Loading
**Problem**: Loading all 1000+ channels causes UI hangs
**Solution**: "Device Channel Selector" loads device list only, then uses text input for channels

### ✅ Channel Discovery
**Problem**: Don't know what channels are available
**Solution**: "List Device Channels" helper action shows all available channels

## Configuration

The switching between dropdown and text-input modes is controlled by:

```javascript
maxChannelsForDropdowns: 500  // default
```

**In module configuration:**
- Set higher (e.g., 1000) if your system can handle more dropdown items
- Set lower (e.g., 200) if you want text-input mode for smaller domains
- The module automatically switches modes based on total RX channel count

## Troubleshooting Learn Functionality

### Learn Button Not Working?

**Check these common issues:**

1. **Device not selected**: Learn only works after selecting an RX device
2. **Domain not loaded**: Ensure module status is green (connected)
3. **Invalid channel names**: Channel names must match exactly what's in the domain
4. **Module still loading**: Wait for initial domain poll to complete
5. **RX Channel fields empty**: Learn only works for RX channels that have names entered

**For "Subscribe Multiple Channels (Text Input)" - Individual Fields:**
- Enter RX channel names first, then click Learn
- Learn populates the TX device/channel fields for each RX channel with a name
- Empty RX channel fields are ignored

**For "Subscribe Multiple Channels (Simple Text)":**
- Learn generates semicolon-separated text in the mappings field
- Shows all channels on the device, not just the ones you've configured

**For "Device Channel Selector":**
- Learn populates TX device/channel for the specific RX channel entered

### Debug Steps:

1. **Test with "List Device Channels" action** first to see available channels
2. **Check logs** for any error messages about missing devices/channels  
3. **Verify exact channel names** using the helper action output
4. **Ensure RX device is selected** before expecting learn to work

### Expected Learn Behavior:

**Before Learn:**
```
RX Device: MyMixer
RX Channel 1: Input-1
TX Device 1: [empty]
TX Channel 1: [empty]
```

**After Learn:**
```
RX Device: MyMixer  
RX Channel 1: Input-1
TX Device 1: SourceDevice
TX Channel 1: Output-3
```

## Performance Benefits

**Text Input Mode:**
- ✅ No UI hangs from massive dropdowns
- ✅ Faster action configuration
- ✅ Lower memory usage
- ✅ Works with any domain size

**Smart Device Selection:**
- ✅ Load only device names (typically <100 items)
- ✅ Channel names entered as needed
- ✅ Progressive disclosure of complexity

## Migration Guide

**If you're currently using dropdown mode:**
- Actions automatically switch to text-input when limit exceeded
- Existing actions continue to work
- New text-input actions provide additional capabilities

**If you want to force text-input mode:**
- Lower `maxChannelsForDropdowns` in module configuration
- Useful for consistent behavior across different domain sizes

## Tips for Large Domains

1. **Use the Helper Action**: Run "List Device Channels" first to see available channels
2. **Learn Current State**: Always use "Learn" buttons to see existing subscriptions  
3. **Batch Operations**: Use "Subscribe Multiple" for setting many channels at once
4. **Device-Centric Workflow**: Use "Device Channel Selector" for device-by-device configuration
5. **Copy-Paste Friendly**: Channel names are output in quotes for easy copying from logs
