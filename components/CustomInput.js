import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Theme } from '../constants/Theme';

export default function CustomInput({ 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry, 
  style, 
  ...props 
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          style
        ]}
        placeholder={placeholder}
        placeholderTextColor={Theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Theme.spacing.l,
  },
  input: {
    backgroundColor: Theme.colors.transparentLight,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: Theme.borderRadius.l,
    padding: Theme.spacing.m,
    color: Theme.colors.text,
    fontSize: 16,
    ...Theme.shadows.glass,
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  }
});
