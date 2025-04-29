import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ModernButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  color?: string;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  color = '#007aff',
}) => {
  const buttonStyle: ViewStyle = {
    ...styles.button,
    backgroundColor: variant === 'primary' ? color : 'transparent',
    borderColor: color,
    opacity: disabled ? 0.5 : 1,
  };

  const textStyle: TextStyle = {
    ...styles.text,
    color: variant === 'primary' ? '#fff' : color,
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 