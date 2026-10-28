export function isPropertyDeletionConfirmationValid(
  confirmationText: string,
  propertyName: string,
) {
  return confirmationText.trim() === propertyName.trim();
}

