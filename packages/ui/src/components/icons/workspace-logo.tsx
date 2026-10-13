function WorkspaceLogo({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {name.trim()[0]?.toUpperCase() ?? "W"}
    </span>
  );
}

export { WorkspaceLogo };
