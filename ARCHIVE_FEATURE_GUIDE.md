# 📦 Archive & Recently Accessed Feature Guide

## ✨ What's New

Your Dashboard now has three powerful new features:

### 1. **Live vs Archived Companies** 📂
- **Live Companies Tab**: Shows all active companies you're working with
- **Archived Tab**: Stores companies you've completed or want to hide

### 2. **Quick Archive Actions** 🗃️
- Hover over any company card to see the archive button (folder icon)
- Click to instantly archive/restore companies
- Archive keeps all data safe - nothing is deleted!

### 3. **Recently Accessed Sorting** ⏱️
- Most recently viewed company always appears first
- Automatic tracking when you open a company
- Makes it easy to resume where you left off

---

## 🎯 How to Use

### Archiving a Company
1. Navigate to your Dashboard
2. Find the company you want to archive
3. Hover over the company card
4. Click the **folder icon** (appears next to delete button)
5. Company moves to "Archived" tab

### Restoring a Company
1. Click the **"Archived"** tab at the top
2. Hover over the archived company
3. Click the **sparkles icon** to restore
4. Company returns to "Live Companies" tab

### View Recently Accessed
- Companies automatically sort by last accessed
- Click any company to view details
- It will automatically move to the top of the list

---

## 💡 Use Cases

### **Active Projects**
Keep live companies for:
- Ongoing work
- Recent clients
- Active campaigns

### **Archive for:**
- ✅ Completed projects
- 🔍 Reference-only clients
- 📦 Seasonal businesses (off-season)
- 🧹 Decluttering your workspace

---

## 🔧 Technical Details

### Database Changes
- Added `archived` boolean column (default: false)
- Added `last_accessed_at` timestamp (tracks view time)
- Indexed for fast sorting and filtering

### Performance
- Smart caching prevents unnecessary reloads
- Debounced search works across both views
- Real-time updates with 500ms debounce

### Security
- Existing RLS policies apply to archived companies
- Only organization members can archive/restore
- All actions are tracked and reversible

---

## 📊 Dashboard Overview

```
┌─────────────────────────────────────┐
│  [Live Companies]  [Archived]       │ ← Tabs with counts
├─────────────────────────────────────┤
│  🔍 Search companies...             │ ← Search works on both tabs
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐  ┌──────────┐       │
│  │ Company  │  │ Company  │       │ ← Most recent first
│  │ (hover)  │  │          │       │
│  │ 📁 🗑️    │  │          │       │ ← Archive & Delete buttons
│  └──────────┘  └──────────┘       │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 Tips & Tricks

1. **Stay Organized**: Archive completed projects monthly
2. **Quick Access**: Your most recent company is always first
3. **Search Across Both**: Search works in Live and Archived views
4. **No Data Loss**: Archiving doesn't delete anything
5. **Easy Restore**: Unarchive anytime with one click

---

## ⚡ Keyboard-Friendly

While there are no keyboard shortcuts yet, the interface is designed for:
- Fast clicking/tapping
- Minimal mouse movement
- Clear visual feedback

---

## 📈 Coming Soon (Potential Enhancements)

- Bulk archive/restore multiple companies
- Auto-archive after X days of inactivity
- Archive reasons/notes
- Archive date tracking
- Export archived companies list

---

## 🐛 Troubleshooting

**Q: Archived company not showing up?**
- Make sure you're on the "Archived" tab
- Try refreshing the page
- Check if search filter is active

**Q: Can't archive a company?**
- Verify you have admin/owner permissions
- Check your organization membership
- Try refreshing and retry

**Q: Company sorting seems wrong?**
- Sorting is by `last_accessed_at` timestamp
- Only updates when you visit the company details page
- Dashboard view doesn't update the timestamp

---

## 🔐 Security Notes

- Archive status respects Row Level Security (RLS)
- Only organization members can view/archive
- All actions are logged and reversible
- No data is permanently deleted

---

**Enjoy your organized Dashboard! 🎉**
