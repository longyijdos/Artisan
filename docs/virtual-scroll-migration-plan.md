# 虚拟滚动迁移方案：手搓实现 → react-virtuoso

## 背景

当前 `ChatTimeline.tsx` 中的虚拟滚动为手搓实现，存在以下问题：

1. **滚动不跟手**：每次 scroll 事件都 `setScrollTop` 触发 React re-render，快速滚动时调度器合并/延迟更新
2. **上滑跳动**：scroll position correction 在 `useEffect`（paint 之后）才执行，存在一帧视觉跳动
3. **流式输出卡顿**：ResizeObserver → RAF → setState 级联更新，消息流式输出时触发大量重渲染
4. **高度估算偏差**：`estimateRowHeight` 与实际值偏差大，首次滚入未测量区域时位置跳变

迁移目标：用 `react-virtuoso` 替代手搓虚拟滚动，同时替换 `use-stick-to-bottom`（Virtuoso 内置 follow-output + atBottom 能力）。

## 迁移涉及的文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `package.json` | 依赖变更 | 添加 `react-virtuoso`，移除 `use-stick-to-bottom` |
| `ChatTimeline.tsx` | **重写核心** | 删除 ~200 行手搓虚拟化代码，改用 Virtuoso |
| `ChatPanel.tsx` | 中度修改 | 移除 `scrollRef` / `contentRef` 接线，接入 Virtuoso 的 ref 和回调 |
| `hooks/useChatScroll.ts` | 重写 | 移除 `use-stick-to-bottom`，封装 Virtuoso 的 scrollToBottom / isAtBottom |
| `hooks/useChatHistoryPagination.ts` | 简化/删除 | 用 Virtuoso 的 `startReached` 替代手动 scroll 监听 |

## 详细方案

### Step 1：安装依赖

```bash
yarn add react-virtuoso
yarn remove use-stick-to-bottom
```

### Step 2：重写 `useChatScroll.ts`

**目标**：保持对外接口 `UseChatScrollReturn` 尽量不变，内部改为操作 Virtuoso 的 `VirtuosoHandle`。

```ts
// hooks/useChatScroll.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { VirtuosoHandle } from "react-virtuoso";

export interface UseChatScrollReturn {
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  scrollToBottom: (options?: { animation?: "smooth" | "instant" }) => void;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  composerHeight: number;
  composerRef: React.RefObject<HTMLFormElement | null>;
}

export function useChatScroll(): UseChatScrollReturn {
  const [composerHeight, setComposerHeight] = useState(84);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const scrollToBottom = useCallback(
    (options?: { animation?: "smooth" | "instant" }) => {
      const behavior = options?.animation === "instant" ? "auto" : "smooth";
      virtuosoRef.current?.scrollToIndex({
        index: "LAST",
        behavior,
      });
    },
    [],
  );

  // 保留 composerHeight 的 ResizeObserver 追踪（这部分不变）
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const updateHeight = () => setComposerHeight(Math.max(composer.offsetHeight, 72));
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(composer);
    return () => observer.disconnect();
  }, []);

  return {
    virtuosoRef,
    scrollToBottom,
    isAtBottom,
    setIsAtBottom,
    composerHeight,
    composerRef,
  };
}
```

**变化点**：
- 移除 `scrollRef`、`contentRef`（Virtuoso 自己管理滚动容器）
- 新增 `virtuosoRef`：传给 `<Virtuoso ref={...}>`
- 新增 `setIsAtBottom`：由 Virtuoso 的 `atBottomStateChange` 回调驱动
- `scrollToBottom` 改为调用 `virtuosoRef.current.scrollToIndex({ index: "LAST" })`

### Step 3：重写 `ChatTimeline.tsx`（核心变更）

#### 3a. 删除以下代码（约 200 行）

- 常量：`VIRTUALIZE_THRESHOLD`、`VIRTUAL_OVERSCAN_PX`、`TIMELINE_GAP_PX`
- 函数：`lowerBound()`
- State：`scrollTop`、`viewportHeight`、`rowHeights`
- Ref：`rowObserverRef`、`rowElementsRef`、`pendingHeightUpdatesRef`、`heightFlushRafRef`、`prevRowSizesRef`
- 逻辑：`flushPendingHeightUpdates`、`scheduleHeightFlush`、`bindMeasuredRow`
- 计算：`shouldVirtualize`、`rowSizes`、`virtualState`
- Effect：scroll metrics 追踪（第 313-337 行）、ResizeObserver 清理（第 339-353 行）、scroll position preservation（第 465-491 行）、orphaned observer 清理（第 301-311 行）

#### 3b. 保留以下代码

- `estimateRowHeight()` — 复用为 Virtuoso 的 `defaultItemHeight` / `fixedHeaderContent` 参照
- `renderTimelineRow()` — 渲染逻辑不变
- `timelineRows` useMemo — 数据映射不变
- Welcome card / session switching loader / history error — 这些 **移到 Virtuoso 外部或用 Header 渲染**

#### 3c. 新的 Props 接口

```ts
interface ChatTimelineProps {
  displayTimeline: ChatTimelineItem[];
  isRunning: boolean;
  isHistoryLoading: boolean;
  historyError: string | null;
  showSessionSwitchingLoader: boolean;
  shouldShowWelcomeCard: boolean;
  preRunToolIds: Set<string>;
  onCollectUserInfoSubmit: (toolCallId: string, data: Record<string, string>) => Promise<void>;
  onExampleClick?: (text: string) => void;
  // 移除 scrollContainer，改为：
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  // 上滑加载历史
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  loadOlderHistory: () => Promise<boolean>;
}
```

#### 3d. 核心渲染结构

```tsx
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

export function ChatTimeline({ ... }: ChatTimelineProps) {
  // ── 数据映射（保留现有逻辑） ──
  const timelineRows = useMemo<TimelineRowModel[]>(() => {
    return displayTimeline.map((item, index) => ({
      item,
      nextItemKind: displayTimeline[index + 1]?.kind ?? null,
      shouldAnimate: item.kind === "tool" ? (isRunning && !preRunToolIds.has(item.id)) : false,
    }));
  }, [displayTimeline, isRunning, preRunToolIds]);

  // ── follow-output：流式输出时自动跟随到底部 ──
  const followOutput = useCallback(
    (isAtBottom: boolean) => {
      if (!isAtBottom) return false;
      return isRunning ? "smooth" : false;
    },
    [isRunning],
  );

  // ── 上滑加载历史 ──
  const handleStartReached = useCallback(() => {
    if (isLoadingMoreHistory || !hasMoreHistory) return;
    void loadOlderHistory();
  }, [hasMoreHistory, isLoadingMoreHistory, loadOlderHistory]);

  // 消息数为 0 时不渲染 Virtuoso，展示 Welcome / Loading / Error
  if (displayTimeline.length === 0) {
    return (
      <div className="space-y-4">
        {isHistoryLoading && showSessionSwitchingLoader && (
          <div className="flex min-h-[38vh] w-full items-center justify-center">
            {/* ...现有的 loading UI... */}
          </div>
        )}
        {!isHistoryLoading && historyError && (
          <div className="...">历史消息加载失败：{historyError}</div>
        )}
        <AnimatePresence initial={false}>
          {shouldShowWelcomeCard && (
            <motion.div key="welcome-card" /* ...现有动画 props... */>
              {/* ...现有 welcome card 内容... */}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={timelineRows}
      defaultItemHeight={200}
      overscan={600}
      // ── follow-output（替代 use-stick-to-bottom） ──
      followOutput={followOutput}
      // ── atBottom 状态回调 ──
      atBottomStateChange={setIsAtBottom}
      atBottomThreshold={80}
      // ── 上滑加载历史（替代 useChatHistoryPagination） ──
      startReached={handleStartReached}
      // ── 关键：increaseViewportBy 提供 overscan 缓冲区 ──
      increaseViewportBy={{ top: 600, bottom: 200 }}
      // ── 初始定位到底部 ──
      initialTopMostItemIndex={timelineRows.length - 1}
      // ── 渲染 ──
      itemContent={(index, row) => (
        <div className="pb-4">
          {renderTimelineRow(row, onCollectUserInfoSubmit)}
        </div>
      )}
      // ── 自定义滚动容器的样式 ──
      style={{ height: "100%" }}
    />
  );
}
```

#### 3e. 关键设计决策

**Q：Welcome Card 怎么处理？**

Welcome Card 只在 `displayTimeline.length === 0` 时出现。在 empty state 分支中直接渲染，不经过 Virtuoso。这和当前的 absolute 定位 + pointer-events-none 方式一致。

**Q：gap/间距怎么处理？**

当前用 `TIMELINE_GAP_PX = 16`（即 `space-y-4`）。迁移后在 `itemContent` 中加 `pb-4` 来替代。Virtuoso 不需要知道 gap，因为它测量的是包含 padding 的完整 DOM 高度。

**Q：framer-motion 动画兼容吗？**

`renderTimelineRow` 内部的动画（tool row 的 AnimatePresence）不受影响，因为动画发生在 item 内部。Virtuoso 只关心外层 wrapper 的高度变化，ResizeObserver 会自动捕获动画引起的高度变化。

**Q：为什么不用 `customScrollParent`？**

当前架构中 scroll container 是 `ChatPanel` 里的外层 `<div ref={handleScrollRef}>`，Virtuoso 套在 `motion.div > ChatTimeline` 内部。有两个选择：

- **选项 A**：用 `customScrollParent` 让 Virtuoso 监听外层 scroll container → 需要保留 `scrollContainer` state 传递
- **选项 B（推荐）**：让 Virtuoso 自己做 scroll container，移除外层的 `overflow-y-auto` → 结构更干净

**推荐选项 B**，具体改法见 Step 4。

### Step 4：修改 `ChatPanel.tsx`

#### 4a. 简化 scroll 相关接线

```tsx
// 改前
const {
  scrollRef,          // ← 删除
  contentRef,         // ← 删除
  scrollToBottom,
  isAtBottom: isAtBottomPosition,
  composerRef,
} = useChatScroll();

// 改后
const {
  virtuosoRef,
  scrollToBottom,
  isAtBottom: isAtBottomPosition,
  setIsAtBottom,
  composerRef,
} = useChatScroll();
```

#### 4b. 修改滚动容器 ref

```tsx
// 改前
const handleScrollRef = useCallback((node: HTMLDivElement | null) => {
  setScrollContainer(node);
  scrollRef(node);   // ← use-stick-to-bottom 的 ref
}, [scrollRef]);

// 改后：不再需要 scrollRef 接线
// scrollContainer state 也可以移除（如果选择方案 B）
```

#### 4c. 移除外层 scroll 容器的 overflow

```tsx
// 改前
<div
  ref={handleScrollRef}
  className="flex-1 min-h-0 overflow-y-auto pt-5 [overflow-anchor:none] md:pt-7 pb-4"
>

// 改后：Virtuoso 自己管理 overflow
<div className="flex-1 min-h-0 pt-5 md:pt-7 pb-4">
```

#### 4d. 移除 contentRef 接线

```tsx
// 改前
<motion.div
  ref={(node: HTMLDivElement | null) => {
    timelineContentRef.current = node;
    contentRef(node);  // ← use-stick-to-bottom 的 content ref
  }}
  ...
>

// 改后
<motion.div
  ref={timelineContentRef}
  ...
>
```

#### 4e. 传递新 props 给 ChatTimeline

```tsx
<ChatTimeline
  displayTimeline={displayTimeline}
  isRunning={isRunning}
  isHistoryLoading={isHistoryLoading}
  historyError={historyError}
  showSessionSwitchingLoader={showSessionSwitchingLoader}
  shouldShowWelcomeCard={showWelcomeCard}
  preRunToolIds={preRunToolIdsRef.current}
  onCollectUserInfoSubmit={onCollectUserInfoSubmit}
  onExampleClick={handleExampleClick}
  // ── 新增 ──
  virtuosoRef={virtuosoRef}
  isAtBottom={isAtBottomPosition}
  setIsAtBottom={setIsAtBottom}
  hasMoreHistory={hasMoreHistory}
  isLoadingMoreHistory={isLoadingMoreHistory}
  loadOlderHistory={loadOlderHistory}
  // ── 移除 ──
  // scrollContainer={scrollContainer}  ← 不再需要
/>
```

#### 4f. 移除 `useChatHistoryPagination` 调用

```tsx
// 删除这段
useChatHistoryPagination({
  scrollContainer,
  isHistoryLoading,
  isLoadingMoreHistory,
  hasMoreHistory,
  loadOlderHistory,
});
```

Virtuoso 的 `startReached` 在 ChatTimeline 内部已经处理了。

#### 4g. `useChatStream` 中 `scrollToBottom` 的签名

`useChatStream` 接收 `scrollToBottom: (options?) => void`，这个签名不变，只是内部实现从 `use-stick-to-bottom` 变成了 Virtuoso 的 `scrollToIndex`。**无需修改 `useChatStream`**。

### Step 5：删除 `useChatHistoryPagination.ts`（或保留为空壳）

Virtuoso 的 `startReached` 回调完全替代了手动的 scroll 监听 + scrollHeight 修正逻辑。

Virtuoso 内部会在 prepend 时自动做 scroll position preservation（这是它的核心优势之一），不需要我们手动计算 `prevHeight / delta / scrollTo`。

**可选**：如果想保持 hook 结构整洁，可以将 `startReached` 的逻辑封装成一个简单的 hook，但不是必要的。

### Step 6：验证清单

迁移完成后需验证以下场景：

- [ ] **基本渲染**：消息正常显示，样式无变化
- [ ] **快速滚动**：上下快速滚动无白屏、无卡顿
- [ ] **上滑抽搐**：首次上滑不再出现抖动/跳动
- [ ] **流式输出跟随**：新消息流式输出时，视口自动跟随到底部
- [ ] **手动上滑脱离**：上滑后不再自动跟随，出现「回到底部」按钮
- [ ] **回到底部按钮**：点击按钮平滑滚动到底部
- [ ] **上滑加载历史**：滚动到顶部触发加载，加载后 scroll position 不跳动
- [ ] **会话切换**：切换会话后立即定位到底部
- [ ] **Welcome Card**：新会话显示欢迎卡片，发送消息后消失
- [ ] **Tool 动画**：工具调用行的 framer-motion 入场/退出动画正常
- [ ] **少量消息**：消息数 < 80 时表现正常（之前只有 ≥80 才虚拟化，现在统一用 Virtuoso）
- [ ] **窗口 resize**：浏览器窗口缩放后布局正确

## 风险与注意事项

1. **`customScrollParent` vs Virtuoso 自有容器**：方案中推荐让 Virtuoso 自己管理 scroll container（方案 B）。如果外层 `motion.div` 的进入/退出动画干扰了 Virtuoso 的滚动容器初始化，则需要回退到方案 A（`customScrollParent`）。

2. **framer-motion `exit` 动画**：当会话切换时，整个 `motion.div` 有 exit 动画。Virtuoso 在 unmount 时可能尝试保存状态。需要确认 `key={activeThreadId}` 正确触发 Virtuoso 重建而非复用。

3. **`initialTopMostItemIndex` 与历史加载的交互**：历史加载完成前 timeline 可能为空，需要确保 Virtuoso 在 data 从 `[]` 变为 `[...items]` 时正确定位到底部。可通过 `followOutput` 或在 `isConversationVisible` 变化时调用 `scrollToIndex` 来保证。

4. **`react-virtuoso` 版本**：建议使用 `^4.x`（最新稳定版），API 与文档中描述一致。
