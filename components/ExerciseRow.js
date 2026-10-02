// G52 — one row of an exercise picker, memoised: a parent re-render (every keystroke in the
// search box) no longer re-renders rows whose props did not change. Each screen passes its
// own styles, so the two pickers keep their own look.
import React, { memo, useCallback } from 'react';
import { TouchableOpacity, Text } from 'react-native';

function ExerciseRow({ item, label, onSelect, active = false, style, activeStyle, textStyle, activeTextStyle }) {
  const onPress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <TouchableOpacity
      style={[style, active && activeStyle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[textStyle, active && activeTextStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default memo(ExerciseRow);
