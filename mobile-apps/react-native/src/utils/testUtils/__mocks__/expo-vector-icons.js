// Mock for @expo/vector-icons to prevent font loading issues in tests
const React = require('react');

const createIconComponent = (name) => {
  return React.forwardRef((props, ref) => {
    return React.createElement('Text', {
      ...props,
      ref,
      testID: props.testID || `${name}-icon`,
      children: `[${name}-icon]`,
    });
  });
};

// Export the main icon families used in the app
const Ionicons = createIconComponent('Ionicons');
const AntDesign = createIconComponent('AntDesign');
const MaterialIcons = createIconComponent('MaterialIcons');
const FontAwesome = createIconComponent('FontAwesome');
const Feather = createIconComponent('Feather');

module.exports = {
  Ionicons,
  AntDesign,
  MaterialIcons,
  FontAwesome,
  Feather,
};