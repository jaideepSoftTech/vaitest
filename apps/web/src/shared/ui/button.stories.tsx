import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

// Storybook requirement per 06-TEAM-FRONTEND.md §13 PR checklist: "Storybook
// story for any new shared component, covering all states." This is the
// Week-1 reference story every later shared/ui component's stories file
// follows.
const meta: Meta<typeof Button> = {
  title: "shared/ui/Button",
  component: Button,
  args: { children: "Button" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Disabled: Story = { args: { disabled: true } };
