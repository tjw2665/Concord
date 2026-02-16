# Concord — UI Structure & Components

## Layout (Discord-like, 3-Section)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Concord                    [Identity] [Settings] [─□×]                               │
├──────────────┬──────────────────────────────────────────────────────┬───────────────────────┤
│              │  # general                              [Members]     │  Members │ Connection  │
│  Left Bar    │  ─────────────────────────────────────────────────  │  ─────────────────────  │
│  (Spaces)    │                                                       │  Online — 0            │
│              │  Alice · 2:30 PM                                      │  Channel: # general     │
│  Communities │  Hey everyone! Welcome to the decentralized future.   │  Community: Open        │
│  • Home      │                                                       │  ─────────────────────  │
│    # general │  Bob · 2:31 PM                                        │  [Connection details]   │
│  • Server1   │  Hi Alice! Great to be here.                          │  Status, Network, etc.  │
│    # gen     │                                                       │                        │
│              │  Charlie · 2:32 PM                                    │                        │
│  Personal    │  Welcome! 🎉                                          │                        │
│  • DMs       │  ─────────────────────────────────────────────────  │                        │
│  • My Space  │  [Message @channel...]              [Attach] [Send]   │                        │
│    # private │                                                       │                        │
└──────────────┴──────────────────────────────────────────────────────┴───────────────────────┘
```

### Space Types

| Type | Group | Ownership | Use Case |
|------|-------|-----------|----------|
| **Community** | Open | Open | Anyone can join; collaborative |
| **Personal** | Closed | Closed | Invite-only; private ownership |

Both are collections of chat channels (text/voice).

## Component Hierarchy

```
App
├── MainLayout (resizable 3-panel)
│   ├── LeftBar
│   │   ├── SpaceList
│   │   │   ├── Communities (open)
│   │   │   │   └── SpaceSection[] → ChannelItem[]
│   │   │   └── Personal (closed)
│   │   │       └── SpaceSection[] → ChannelItem[]
│   │   ├── CreateSpaceModal
│   │   └── CreateChannelModal
│   ├── Center (MainContent)
│   │   ├── ConnectionPanel (connect view)
│   │   └── ChatView (chat view)
│   │       ├── ChannelHeader
│   │       ├── MessageList
│   │       └── MessageInput
│   └── RightSidebar
│       ├── Members tab (channel info, member list)
│       └── Connection tab (ConnectionDetails)
├── ResizeHandle (between panels)
└── UpdateChecker
```

## Key Components

### MessageList
- **Virtualization**: TanStack Virtual for 10k+ messages
- **Grouping**: Messages from same author within 5 min → single block
- **Scroll**: Load more on scroll-up (infinite scroll)
- **Optimistic**: Show sent message immediately; confirm on sync

### MessageInput
- **Auto-resize**: Max 10 lines; scroll after
- **Markdown**: Inline preview (optional)
- **Mentions**: @user autocomplete
- **Attachments**: Drag-drop; IPFS upload on send

### Sidebar
- **Collapsible**: Icon-only mode for narrow windows
- **Drag-drop**: Reorder servers
- **Badges**: Unread count, mention count

## Theming (CSS Variables)

```css
:root {
  /* Dark theme (default) */
  --bg-primary: #313338;
  --bg-secondary: #2b2d31;
  --bg-tertiary: #1e1f22;
  --text-primary: #f2f3f5;
  --text-secondary: #b5bac1;
  --accent: #5865f2;
  --accent-hover: #4752c4;
  --danger: #ed4245;
  --success: #3ba55d;
  --border: #3f4147;
  --radius: 8px;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f2f3f5;
  --bg-tertiary: #e3e5e8;
  --text-primary: #060607;
  --text-secondary: #4e5058;
  --border: #e3e5e8;
}
```

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Desktop | ≥1280px | Full layout |
| Tablet | 768–1279px | Collapsible sidebar |
| Compact | <768px | Mobile-style; overlay sidebar |

## Accessibility

- **Keyboard**: Tab navigation; Enter to send; Escape to close modals
- **Screen readers**: ARIA labels on icons; live region for new messages
- **Focus**: Visible focus ring; skip-to-content link

## Performance Targets

- **First paint**: <1s
- **Message render**: <16ms (60fps)
- **Sync latency**: <500ms peer-to-peer
- **Bundle size**: <10 MB (Tauri)
