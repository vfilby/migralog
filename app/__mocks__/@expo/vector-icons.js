const React = require('react');

const createIconComponent = () => {
  return function MockIcon(props) {
    return React.createElement('View', props, props.name);
  };
};

module.exports = {
  Ionicons: createIconComponent(),
  MaterialIcons: createIconComponent(),
  FontAwesome: createIconComponent(),
  FontAwesome5: createIconComponent(),
  MaterialCommunityIcons: createIconComponent(),
  Entypo: createIconComponent(),
  AntDesign: createIconComponent(),
  Feather: createIconComponent(),
};
