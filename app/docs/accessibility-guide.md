# Accessibility Guide

This document outlines the accessibility features implemented in MigraLog and provides guidelines for maintaining and testing accessibility.

## Accessibility Features Implemented

### 1. Screen Reader Support (VoiceOver/TalkBack)

All interactive elements include proper accessibility properties:

- **accessibilityRole**: Identifies the element type (button, switch, etc.)
- **accessibilityLabel**: Provides a clear description of the element
- **accessibilityHint**: Describes what happens when the element is activated
- **accessibilityState**: Indicates current state (selected, disabled, etc.)

**Coverage**: 175+ interactive components across 26 screens and 5 shared components.

### 2. Color Contrast (WCAG 2.1 Level AA)

All text and interactive elements meet WCAG AA standards:

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (≥18pt or ≥14pt bold): Minimum 3:1 contrast ratio

#### Updated Color Values

**Light Theme:**
- Text Secondary: #6C6C70 (4.62:1 on white)
- Primary: #0062CC (5.03:1 on white, 5.80:1 with white text)
- Danger: #D30F00 (5.24:1 with white text)
- Success: #248A3D (4.55:1 on white)

**Dark Theme:**
- Text Secondary: #AEAEB2 (7.69:1 on card background)
- Primary: #0066CC (5.57:1 with white text)
- Danger: #E03020 (4.55:1 with white text)

### 3. Dynamic Text Sizing

The app supports iOS Dynamic Type and Android Font Size settings:

- All text components use `allowFontScaling={true}` (React Native default)
- Layouts use flexbox to adapt to different text sizes
- Minimum touch targets maintained at 44x44 points

**Testing**: Increase text size in device settings (iOS: Settings > Accessibility > Display & Text Size > Larger Text)

### 4. Touch Target Sizes

All interactive elements meet the minimum 44x44 point touch target size requirement:

- Buttons have adequate padding
- Small icons are wrapped in touchable containers with sufficient padding
- List items have minimum 44-point heights

### 5. Semantic Structure

- Proper heading hierarchy (though React Native doesn't expose heading roles)
- Logical reading order matches visual layout
- Related content grouped appropriately

## Testing with VoiceOver (iOS)

### Enabling VoiceOver

1. **Settings** > **Accessibility** > **VoiceOver** > Toggle ON
2. Or use triple-click home/side button (if configured)
3. Or ask Siri: "Turn on VoiceOver"

### VoiceOver Gestures

- **Swipe right**: Move to next element
- **Swipe left**: Move to previous element
- **Double tap**: Activate selected element
- **Three-finger swipe left/right**: Scroll pages
- **Two-finger scrub** (Z-shape): Go back
- **Rotor** (two-finger rotation): Adjust reading settings

### Testing Checklist

- [ ] All buttons announce their purpose clearly
- [ ] Navigation is logical and intuitive
- [ ] Form inputs describe what information is needed
- [ ] Error messages are announced
- [ ] Loading states are announced
- [ ] Modal dialogs announce when opened/closed
- [ ] Tab bar items announce current/selected state

## Testing with TalkBack (Android)

### Enabling TalkBack

1. **Settings** > **Accessibility** > **TalkBack** > Toggle ON
2. Or long-press volume keys (if configured)

### TalkBack Gestures

- **Swipe right**: Move to next element
- **Swipe left**: Move to previous element
- **Double tap**: Activate selected element
- **Swipe down then right**: Read from top
- **Two-finger swipe**: Scroll

### Testing Checklist

- [ ] Similar to VoiceOver checklist above
- [ ] Android-specific UI elements (back button, menu) work correctly
- [ ] Bottom sheet modals are accessible

## Color Contrast Validation

The app includes automated color contrast tests:

```bash
npm run test:ci -- src/utils/__tests__/colorContrast.test.ts
```

This test suite validates:
- All theme color combinations
- Light and dark mode compliance
- Hardcoded colors in components

### Manual Testing

Use tools like:
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser**: Desktop app for Mac/Windows
- **Accessibility Inspector** (Xcode): Built-in color contrast checker

## Dynamic Text Sizing

### Testing on iOS

1. **Settings** > **Accessibility** > **Display & Text Size** > **Larger Text**
2. Adjust slider to largest setting
3. Return to app and verify:
   - Text increases in size
   - Layouts don't break or truncate
   - Buttons remain tappable
   - Scrolling works for content that doesn't fit

### Testing on Android

1. **Settings** > **Display** > **Font size**
2. Select largest option
3. Verify same criteria as iOS

### Common Issues to Watch For

- Text truncation (use `numberOfLines` with appropriate value)
- Overlapping text and UI elements
- Buttons with fixed heights that don't expand
- Fixed-width containers that clip text

## E2E Accessibility Tests

Run the accessibility-focused E2E test suite:

```bash
npm run test:ui -- e2e/accessibility.test.js
```

These tests verify:
- Accessibility labels on key interactive elements
- Proper accessibility roles
- Touch target sizes
- Form accessibility
- Navigation patterns

## Guidelines for Maintaining Accessibility

### When Adding New Components

1. **Add accessibility properties to all interactive elements:**
   ```typescript
   <TouchableOpacity
     onPress={handlePress}
     accessibilityRole="button"
     accessibilityLabel="Clear description"
     accessibilityHint="What happens when tapped"
   >
     <Icon name="star" />
   </TouchableOpacity>
   ```

2. **Use theme colors (avoid hardcoded colors):**
   ```typescript
   // Good
   <Text style={{ color: theme.text }}>Content</Text>

   // Bad
   <Text style={{ color: '#888' }}>Content</Text>
   ```

3. **Ensure touch targets are at least 44x44 points:**
   ```typescript
   const styles = StyleSheet.create({
     button: {
       minHeight: 44,
       minWidth: 44,
       padding: 12,
     },
   });
   ```

4. **Allow font scaling (default behavior):**
   ```typescript
   // Good - uses default allowFontScaling={true}
   <Text>Scalable text</Text>

   // Only use when absolutely necessary
   <Text allowFontScaling={false}>Fixed size text</Text>
   ```

5. **Test with VoiceOver/TalkBack** before merging

### Accessibility Props Reference

- **accessibilityRole**: `"button" | "header" | "link" | "switch" | "tab" | "image" | "text" | ...`
- **accessibilityLabel**: Brief description (e.g., "Settings", "Delete medication")
- **accessibilityHint**: Action description (e.g., "Opens settings screen", "Removes this medication")
- **accessibilityState**: `{ disabled?: boolean; selected?: boolean; checked?: boolean; expanded?: boolean }`
- **accessibilityValue**: For sliders and progress indicators

### For Text Inputs

```typescript
<TextInput
  accessibilityLabel="Medication name"
  accessibilityHint="Enter the name of the medication"
  placeholder="e.g., Ibuprofen"
/>
```

### For Toggles/Switches

```typescript
<Switch
  accessibilityRole="switch"
  accessibilityLabel="Enable notifications"
  accessibilityState={{ checked: isEnabled }}
  value={isEnabled}
  onValueChange={setIsEnabled}
/>
```

### For Lists

```typescript
<FlatList
  data={items}
  renderItem={({ item }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${item.name} medication`}
      accessibilityHint="Tap to view details"
    >
      <Text>{item.name}</Text>
    </TouchableOpacity>
  )}
  accessibilityLabel="Medications list"
/>
```

## Resources

- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS Accessibility](https://developer.apple.com/accessibility/ios/)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Apple Human Interface Guidelines - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Material Design - Accessibility](https://material.io/design/usability/accessibility.html)

## Reporting Accessibility Issues

If you encounter accessibility issues:

1. **For developers**: Create a GitHub issue with:
   - Screen/component affected
   - Device and OS version
   - Screen reader being used (if applicable)
   - Steps to reproduce
   - Expected vs. actual behavior

2. **For users**: Contact support with details about the accessibility barrier you encountered

## Compliance

MigraLog aims to meet:
- **WCAG 2.1 Level AA** for web content accessibility
- **iOS Human Interface Guidelines** for accessibility
- **Android Accessibility Guidelines**

Last updated: 2025-11-15
