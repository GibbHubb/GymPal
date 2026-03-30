import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Theme } from '../constants/Theme';

export default function CustomButton({ 
  title, 
  onPress, 
  loading = false, 
  style, 
  textStyle, 
  disabled = false 
}) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.buttonDisabled : null, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#1A1A1A" />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.m,
    paddingGymPaltal: Theme.spacing.l,
    borderRadius: Theme.borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#6b5407',
    opacity: 0.6,
  },
  text: {
    color: '#1A1A1A',
    fontWeight: 'bold',
    fontSize: 16,
    textTransform: 'uppercase',
  },
});
