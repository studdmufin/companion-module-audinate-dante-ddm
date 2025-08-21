# Large Domain Guide (Enhancements, Usage, and Performance)

This guide consolidates the previous large-domain documents into a single reference. It explains when the module switches to text-input mode, how to use the actions/feedbacks in large domains, and what performance improvements are built in.

## When large-domain mode activates

- The module switches to text-input ("large") mode when the total RX channel count exceeds `maxChannelsForDropdowns` (default: 500).
- You can change this threshold in the module configuration.

## Actions in large domains

Text-input mode avoids generating massive dropdowns. Use exact device and channel names.

- Subscribe Dante Channel (Text Input)
  - Single RX channel subscription via text inputs.
  - RX Device Name, RX Channel Name, TX Device Name, TX Channel Name (leave TX blank to clear).

- Subscribe Multiple Dante Channels (Text Input)
  - RX Device dropdown, then per-channel rows for RX names and TX mapping (supports Clear/Ignore per row).
  - Optional: Auto-use the device's RX channel names in order.
  - Learn: Populates per-row TX mapping from the current device subscriptions.

- Subscribe Multiple Channels (Simple Text)
  - RX Device dropdown and a single semicolon-separated mapping field.
  - Format: `Rx1=TxCh1@TxDev1; Rx2=TxCh2@TxDev2; Rx3=` (empty after `=` clears).
  - Learn: Generates the mapping string from current device subscriptions.

- List Device Channels (Helper)
  - Logs all RX/TX channels for a selected device and shows current RX subscriptions.
  - Useful to discover exact names for text-input actions.

- Force Full Fetch (shared)
  - Immediately refresh all domain data and re-check feedbacks. Available in both small and large modes.

## Feedbacks in large domains

To prevent UI timeouts, minimal feedbacks are used in large mode.

- Multi-Channel Subscription Status (Simple Text)
  - RX Device dropdown and an `expectedMappings` text field with semicolon-separated mappings.
  - Returns true only when the device's actual subscriptions match the expected mapping string.
  - Learn: Populates `expectedMappings` from the device's current subscriptions.

Note: In small domains, full feedbacks are available (per-channel dropdowns, selector-based checks, etc.).

## How to find names for text-input fields

- Dante Controller: Browse device and channel names.
- DDM Web Interface: Browse your domain's device lists and channels.
- Helper action: Use "List Device Channels" to print names in logs for copy/paste.

## Tips and examples

- Be precise: Names must match exactly (case-sensitive).
- Use copy/paste from Dante tools or the helper action output.
- Start small: Try one or two channels to validate naming.

Examples (Simple Text):

```
1=Input1@Mixer; 2=Input2@Mixer; 3=; 4=Monitor@MonitorDeck
Input-L=Music-L@Playout; Input-R=Music-R@Playout; Talkback=TB@Studio
```

## Learn troubleshooting

- Select the RX device before using Learn.
- Wait for the module status to be OK and initial poll to complete.
- Ensure RX channel names are provided (for the per-row text-input action, Learn fills TX only for rows with RX names).
- Use the helper action to verify exact channel names.

## Configuration

- Max Channels for Dropdown UI (`maxChannelsForDropdowns`): default 500.
  - Increase if your system can handle more dropdown items.
  - Decrease to force text-input mode on smaller domains.
- Poll Interval (`pollInterval`): how often the module polls domain data.
- Full Fetch Interval (`fullFetchInterval`): perform a full domain refresh every N polls.

Advanced caps (hard RX/TX caps and combined complexity) are not used.

## Performance improvements

- Non-blocking initialization: Network calls run in the background so Companion loads immediately.
- Smart polling strategy:
  - Subscriptions-only poll most of the time for responsiveness and low load.
  - Full domain refresh on first poll and every `fullFetchInterval` polls.
- Apollo cache strategies to reduce server load during frequent polls.
- Configurable poll interval (default 5s) to tune frequency.
- Better error handling with graceful fallbacks, plus clearer logs.
- Dependency updates eliminated deprecated warnings.

## Migration notes

- Existing configurations continue to work; the module automatically switches modes based on RX channel count.
- To force text-input mode, lower `maxChannelsForDropdowns` in the configuration.

## Quick checklist for large domains

- Use the helper action to list device channels and confirm names.
- Prefer the multi-channel actions to batch operations.
- Use Learn to mirror current subscriptions into your configuration fields.
- If you experience slowdowns, increase `pollInterval` or reduce the frequency of full fetches with `fullFetchInterval`.
