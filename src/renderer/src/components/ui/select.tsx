import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      'flex h-7 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--theme-light)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:min-w-0 [&>span]:truncate',
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectScrollUpButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    className={cn('flex items-center justify-center py-1', className)}
    ref={ref}
    {...props}
  >
    <ChevronUp className="size-3.5" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

export const SelectScrollDownButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    className={cn('flex items-center justify-center py-1', className)}
    ref={ref}
    {...props}
  >
    <ChevronDown className="size-3.5" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ align = 'start', className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      align={align}
      className={cn(
        'relative z-50 max-h-72 !w-[var(--radix-select-trigger-width)] !min-w-[var(--radix-select-trigger-width)] !max-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-700 shadow-lg',
        position === 'popper' && 'translate-y-1',
        className
      )}
      position={position}
      ref={ref}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="!w-full min-w-0 max-w-full overflow-hidden p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    className={cn('px-2 py-1 text-[11px] font-medium text-slate-400', className)}
    ref={ref}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex w-full min-w-0 cursor-default select-none items-center overflow-hidden rounded-sm py-1.5 pl-7 pr-2 text-xs outline-none focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 [&>span:last-child]:overflow-hidden',
      className
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>
      <span className="block max-w-full truncate whitespace-nowrap">{children}</span>
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    className={cn('my-1 h-px bg-slate-100', className)}
    ref={ref}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName
