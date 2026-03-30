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
  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, style]}
        placeholder={placeholder}
        placeholderTextColor={Theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Theme.spacing.m,
  },
  input: {
    backgroundColor: Theme.colors.transparentLight,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: Theme.borderRadius.m,
    padding: Theme.spacing.m,
    color: Theme.colors.text,
    fontSize: 16,
  },
});
