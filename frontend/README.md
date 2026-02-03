# Urban Policy Decision Engine - Frontend

React-based user interface for the Urban Policy Decision Engine air quality management system.

## 📦 Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "axios": "^1.6.0",
  "react-scripts": "5.0.1"
}
```

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
```

Builds the app for production in the `build` folder.

## 📁 Component Structure

### Main App (`App.js`)

The root component that manages:
- Global state for sectors, selected sector, policies, simulations
- API communication with backend
- Data polling (every 10 seconds)
- Overall layout and error handling

**Key Functions:**
- `fetchSectors()` - Get all sectors
- `fetchSectorStatus(sectorId)` - Get detailed status
- `fetchPolicy(sectorId)` - Get policy recommendation
- `handleSimulatePolicy()` - Simulate policy impact

### Components

#### 1. SectorList (`components/SectorList.js`)

Displays grid of all city sectors with quick status indicators.

**Props:**
- `sectors` - Array of sector objects
- `selectedId` - Currently selected sector ID
- `onSelectSector(id)` - Callback for selection

**Features:**
- Color-coded by severity (4-point scale)
- Emoji indicators (✅ 🟢 🟡 🟠 🔴)
- Quick PM2.5, traffic, wind overview
- Hover effects and transitions

**Severity Levels:**
```javascript
hazardous        (PM2.5 > 250)  🔴
very-unhealthy   (PM2.5 > 200)  🟠
unhealthy        (PM2.5 > 150)  🟡
unhealthy-sensitive (PM2.5 > 100) 🟢
moderate         (PM2.5 ≤ 100)  ✅
```

#### 2. SectorDetail (`components/SectorDetail.js`)

Comprehensive status panel for selected sector.

**Props:**
- `status` - Sector status object with readings
- `onRefresh()` - Refresh callback

**Displays:**
- Current PM2.5 (with health scale)
- PM10 (coarse particles)
- Traffic index (0-100% progress bar)
- Wind speed (m/s with dispersal indicator)
- Pollution cause analysis
- PM10/PM25 ratio
- Status summary with recommendations

**Pollution Cause Analysis:**
- Analyzes PM10/PM25 ratio
- Suggests primary pollution source
- Helps prioritize policy response

#### 3. PolicyCard (`components/PolicyCard.js`)

Policy recommendation with simulation capability.

**Props:**
- `policy` - Policy data from backend
- `onSimulate(policyName)` - Simulation callback
- `simulation` - Simulation results (if available)

**Shows:**
- Policy name with priority badge
- Detailed reason for recommendation
- Expected PM2.5 reduction %
- Time to effect (hours)
- Simulate button

**Simulation Results Display:**
- Current PM2.5 (red)
- Predicted PM2.5 after (green)
- Reduction % with visualization
- Wind impact explanation
- Action recommendation

**Priority Levels:**
- 🔴 Critical - Highest urgency
- 🟠 High - Medium urgency
- 🟡 Medium - Low urgency

## 🎨 Styling System

### CSS Architecture

Each component has its own CSS file with modular styles:
- `App.css` - Main layout and global styles
- `SectorList.css` - Sector card styles
- `SectorDetail.css` - Detail panel styles
- `PolicyCard.css` - Policy recommendation styles

### Color Palette

```css
Primary: #667eea (purple-blue)
Secondary: #764ba2 (deeper purple)
Success: #4caf50 (green)
Warning: #ffc107 (amber)
Error: #f44336 (red)
Info: #2196f3 (blue)
```

### Responsive Breakpoints

```css
Mobile: max-width: 768px
Tablet: 768px - 1024px
Desktop: 1024px+
```

The layout switches from multi-column to single-column on mobile.

## 🔄 Data Flow

```
App.js
  ├─ fetchSectors() [10s interval]
  │  └─ Populates SectorList
  │
  ├─ fetchSectorStatus(selectedId) [10s interval]
  │  └─ Populates SectorDetail
  │
  ├─ fetchPolicy(selectedId) [10s interval]
  │  └─ Populates PolicyCard
  │
  └─ handleSimulatePolicy() [on-demand]
     └─ Updates PolicyCard.simulation
```

### API Integration

All API calls use Axios with:
- Base URL: `http://localhost:8000`
- Error handling with user-friendly messages
- Automatic JSON parsing

```javascript
const API_BASE = 'http://localhost:8000';

// Example: Fetch sectors
axios.get(`${API_BASE}/sectors`)
  .then(response => setSectors(response.data))
  .catch(err => setError('Failed to fetch sectors'));
```

## 🔔 Polling Strategy

```javascript
// 10-second poll interval
useEffect(() => {
  const interval = setInterval(() => {
    fetchSectors();
    fetchSectorStatus(selectedSectorId);
    fetchPolicy(selectedSectorId);
  }, 10000);

  return () => clearInterval(interval);
}, [selectedSectorId]);
```

**Benefits:**
- Real-time data updates
- User sees fresh recommendations
- 10s interval balances freshness vs. server load

**Can be adjusted in `App.js` line ~100**

## 🚨 Error Handling

**Error Banner:**
- Displays at top if backend connection fails
- Shows user-friendly message
- Automatically clears when connection restored

**Loading States:**
- Shows "Loading..." while fetching
- Disables buttons during simulation
- Visual feedback for all async operations

## 🎯 Key Features

1. **Real-time Updates**
   - Auto-refresh every 10 seconds
   - No manual refresh needed
   - Smooth transitions

2. **Color-Coded Severity**
   - Instant visual indicator
   - Consistent throughout app
   - Helps prioritize attention

3. **Policy Simulation**
   - One-click impact prediction
   - Before/after comparison
   - Wind-aware effectiveness

4. **Responsive Design**
   - Works on all screen sizes
   - Touch-friendly on mobile
   - Flexible grid layouts

5. **Detailed Analysis**
   - Pollution cause detection
   - Ratio-based insights
   - Health recommendations

## 🛠️ Customization

### Change Polling Interval

In `App.js` (line ~130):
```javascript
}, 10000); // Change 10000 to desired milliseconds
```

### Modify Color Scheme

Edit CSS files, e.g., `App.css`:
```css
.app-header {
  background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
}
```

### Add New Component

1. Create `src/components/NewComponent.js`
2. Create `src/components/NewComponent.css`
3. Import in `App.js`
4. Add to JSX

### Change Layout

Modify `.app-container` in `App.css`:
```css
.app-container {
  /* Change flex-direction for different layout */
  /* Adjust gap and padding as needed */
}
```

## 📱 Mobile Considerations

- Sidebar collapses to main content on mobile
- Touch targets are appropriately sized
- Text scales responsively
- Grid becomes single column
- Buttons have adequate padding

## ♿ Accessibility

- Semantic HTML elements
- Color contrast meets WCAG standards
- Keyboard navigable buttons
- ARIA labels recommended for icons
- Screen reader friendly text

## 🧪 Testing

While not included in this prototype, consider adding:

```javascript
// Example test structure
describe('SectorList', () => {
  it('should render all sectors', () => {
    // Test implementation
  });

  it('should call onSelectSector when clicked', () => {
    // Test implementation
  });
});
```

## 🚀 Production Deployment

### Build Process

```bash
npm run build
```

Creates optimized production build in `build/` folder.

### Deployment Options

1. **Static Hosting** (Vercel, Netlify, GitHub Pages)
   - Upload `build/` folder contents
   - Configure API endpoint via environment variables

2. **Container** (Docker)
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY build ./build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

### Environment Configuration

Create `.env` for different environments:

```env
# .env.development
REACT_APP_API_BASE=http://localhost:8000

# .env.production
REACT_APP_API_BASE=https://api.example.com
```

Then use:
```javascript
const API_BASE = process.env.REACT_APP_API_BASE;
```

## 📝 Code Comments

The codebase includes:
- Function-level documentation
- Inline comments explaining logic
- JSDoc-style comments for components
- Clear variable names

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot reach backend" | Ensure backend running on :8000 |
| Styles not loading | Clear browser cache (Ctrl+Shift+R) |
| Data not updating | Check browser console for errors |
| Buttons not responding | Check that backend endpoints are working |

## 📚 Further Reading

- [React Hooks Documentation](https://react.dev/reference/react)
- [Axios Documentation](https://axios-http.com/)
- [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)

---

**Last Updated:** January 2026
