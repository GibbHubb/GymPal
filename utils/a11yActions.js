// G61 — screen-reader actions for controls that do something different on long press.
// TalkBack/VoiceOver users cannot long-press a control the way a finger does, so the long-press
// behaviour has to be offered as a named accessibility action as well:
//
//   <TouchableOpacity
//     onPress={toggleA} onLongPress={toggleB}
//     accessibilityActions={activateAndLongPress('Link with the previous exercise')}
//     onAccessibilityAction={a11yActionHandler({ activate: toggleA, longpress: toggleB })}
//   />

/** The standard activate action plus a labelled long-press action. */
export function activateAndLongPress(longPressLabel) {
  return [{ name: 'activate' }, { name: 'longpress', label: longPressLabel }];
}

/** -> an onAccessibilityAction handler that runs handlers[actionName], ignoring unknown actions. */
export function a11yActionHandler(handlers) {
  return (event) => {
    const fn = handlers[event?.nativeEvent?.actionName];
    if (typeof fn === 'function') fn();
  };
}
