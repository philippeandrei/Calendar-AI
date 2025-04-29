import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';

interface ColorPickerProps {
  onColorSelected: (color: string) => void;
  initialColor?: string;
}

const colorOptions = [
  '#007aff', // iOS Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#FF2D55', // Pink
  '#5856D6', // Purple
  '#FF3B30', // Red
  '#5AC8FA', // Light Blue
  '#AF52DE', // Deep Purple
  '#FFCC00', // Yellow
  '#00C7BE', // Teal
  '#FF6B6B', // Coral
  '#4ECDC4', // Turquoise
];

const ColorPicker: React.FC<ColorPickerProps> = ({ onColorSelected, initialColor = '#007aff' }) => {
  const renderColorItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.colorOption, { backgroundColor: item }]}
      onPress={() => onColorSelected(item)}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={colorOptions}
        renderItem={renderColorItem}
        keyExtractor={(item) => item}
        numColumns={4}
        contentContainerStyle={styles.colorGrid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  colorGrid: {
    justifyContent: 'center',
    padding: 10,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    margin: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ColorPicker; 