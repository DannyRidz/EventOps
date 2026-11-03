import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  readonly variant?: "primary" | "secondary";
};

export function Button({
  children,
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button ${variant === "secondary" ? "button-secondary" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
