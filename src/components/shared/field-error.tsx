export function FieldError({ errors }: { errors?: string[] }) { if (!errors?.length) return null; return <p className="text-xs text-destructive">{errors[0]}</p>; }
