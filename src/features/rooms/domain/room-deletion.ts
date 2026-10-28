export function isRoomDeletionConfirmationValid(
  confirmationText: string,
  roomName: string,
) {
  return confirmationText.trim() === roomName.trim();
}

