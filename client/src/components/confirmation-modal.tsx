import { useState } from 'react';
import { Modal, Button, TextControl, Notice } from '@wordpress/components';

interface ConfirmationModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmationText?: string; // Text user must type to confirm
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

function ConfirmationModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmationText,
  isDestructive = false,
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
}: ConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('');

  const isConfirmDisabled = confirmationText
    ? inputValue !== confirmationText
    : false;

  return (
    <Modal
      title={title}
      onRequestClose={onCancel}
      isDismissible={!isLoading}
    >
      <div style={{ minWidth: '400px' }}>
        {error && (
          <div style={{ marginBottom: '1rem' }}>
            <Notice status="error" isDismissible={false}>
              {error}
            </Notice>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          {message}
        </div>

        {confirmationText && (
          <div style={{ marginBottom: '1.5rem' }}>
            <TextControl
              label={`Type "${confirmationText}" to confirm:`}
              value={inputValue}
              onChange={setInputValue}
              disabled={isLoading}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            isDestructive={isDestructive}
            onClick={onConfirm}
            isBusy={isLoading}
            disabled={isConfirmDisabled || isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmationModal;
