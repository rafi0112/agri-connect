/**
 * Agriculture-themed color palette for the app.
 * This defines our modern, nature-inspired colors for both light and dark modes.
 */

// Primary colors
const primaryGreen = '#2E7D32'; // Deep forest green
const primaryLight = '#4CAF50'; // Medium green
const primaryDark = '#1B5E20'; // Darker forest green
const accentGreen = '#8BC34A'; // Light green
const highlightGreen = '#DCEDC8'; // Very light green

// Secondary colors
const earthBrown = '#795548'; // Soil brown
const warmOrange = '#FF9800'; // Harvest orange
const sunYellow = '#FFC107'; // Sunlight yellow
const skyBlue = '#03A9F4'; // Sky blue

// Neutral colors
const lightBackground = '#F9FBF7'; // Off-white with slight green tint
const darkBackground = '#1C2719'; // Very dark green, almost black

// Utility colors
const successGreen = '#4CAF50';
const warningOrange = '#FF9800';
const errorRed = '#F44336';
const infoBlue = '#2196F3';

export const Colors = {
  light: {
    // Base colors
    primary: primaryGreen,
    primaryLight: primaryLight,
    primaryDark: primaryDark,
    accent: accentGreen,
    highlight: highlightGreen,
    secondary: earthBrown,
    
    // UI colors
    text: '#263238',
    textLight: '#546E7A',
    textDark: '#0D1B2A',
    textPrimary: '#263238',
    textSecondary: '#546E7A',
    textMuted: '#90A4AE',
    background: lightBackground,
    card: '#FFFFFF',
    cardAlt: '#F5F7F3',
    cardBackground: '#FFFFFF',
    cardBackgroundLight: '#F5F7F3',
    border: '#EAEFEA',
    
    // Tab bar
    tint: primaryGreen,
    icon: '#78909C',
    tabIconDefault: '#78909C',
    tabIconSelected: primaryGreen,
    tabBar: '#F9FBF7',
    
    // Status colors
    success: successGreen,
    successLight: '#E8F5E9',
    warning: warningOrange,
    warningLight: '#FFF3E0',
    error: errorRed,
    errorLight: '#FFEBEE',
    info: infoBlue,
    infoLight: '#E3F2FD',
    pending: sunYellow,
    pendingLight: '#FFFDE7',
    
    // Additional colors
    orange: warmOrange,
    yellow: sunYellow,
    blue: skyBlue,
    
    // Stock status
    lowStock: warningOrange,
    outOfStock: '#FFEBEE', // Light red background
    outOfStockText: errorRed,
    
    // Likes
    likeButton: '#F44336', // Red heart
    likeButtonInactive: '#E0E0E0', // Gray heart
    
    // Opacity variants
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Base colors
    primary: accentGreen,
    primaryLight: '#81C784',
    primaryDark: '#33691E',
    accent: '#AED581',
    highlight: '#43A047',
    secondary: '#A1887F',
    
    // UI colors
    text: '#ECEFF1',
    textLight: '#B0BEC5',
    textDark: '#FFFFFF',
    textPrimary: '#ECEFF1',
    textSecondary: '#B0BEC5',
    textMuted: '#78909C',
    background: darkBackground,
    card: '#2C3730',
    cardAlt: '#232E24',
    cardBackground: '#2C3730',
    cardBackgroundLight: '#323F36',
    border: '#37474F',
    
    // Tab bar
    tint: accentGreen,
    icon: '#B0BEC5',
    tabIconDefault: '#B0BEC5',
    tabIconSelected: accentGreen,
    tabBar: '#1F2923',
    
    // Status colors
    success: '#66BB6A',
    successLight: '#1B5E20',
    warning: '#FFA726',
    warningLight: '#3E2723',
    error: '#EF5350',
    errorLight: '#3E2723',
    info: '#42A5F5',
    infoLight: '#0D47A1',
    pending: '#FFD54F',
    pendingLight: '#3E2F23',
    
    // Additional colors
    orange: '#FFB74D',
    yellow: '#FFD54F',
    blue: '#4FC3F7',
    
    // Stock status
    lowStock: '#FFA726',
    outOfStock: '#3E2723', // Dark red background
    outOfStockText: '#EF9A9A',
    
    // Likes
    likeButton: '#EF5350', // Red heart
    likeButtonInactive: '#616161', // Gray heart
    
    // Opacity variants
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};
