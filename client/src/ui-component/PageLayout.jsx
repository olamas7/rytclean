import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { LdButton } from 'utils/myButtons';
import InlineNavigation from './InlineNavigation';

export const PageHeader = ({ title, description, actions, inlineNavigation }) => {
  const heading = useRef(null);
  const wasInline = useRef(false);
  const active = Boolean(inlineNavigation?.active);
  const view = inlineNavigation?.view;
  useEffect(() => {
    if (active || wasInline.current) heading.current?.focus();
    wasInline.current = active;
  }, [active, view]);
  return (
  <Box>
  <InlineNavigation {...inlineNavigation} />
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    spacing={2}
    justifyContent="space-between"
    alignItems={{ xs: 'stretch', md: 'center' }}
    sx={{ mb: 3 }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography component="h1" variant="h2" ref={heading} tabIndex={-1} sx={{ '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 4 } }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
    {actions && (
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {actions}
      </Stack>
    )}
  </Stack>
  </Box>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actions: PropTypes.node,
  inlineNavigation: PropTypes.shape({ active: PropTypes.bool, view: PropTypes.string, parentLabel: PropTypes.string, onBack: PropTypes.func, disabled: PropTypes.bool })
};

export const FormActions = ({ onCancel, loading = false, disabled = false, submitLabel = 'Save', cancelLabel = 'Cancel' }) => (
  <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ pt: 2 }}>
    {onCancel && (
      <LdButton variant="outlined" color="secondary" onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </LdButton>
    )}
    <LdButton type="submit" loading={loading} disabled={disabled}>
      {submitLabel}
    </LdButton>
  </Stack>
);

FormActions.propTypes = {
  onCancel: PropTypes.func,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  submitLabel: PropTypes.string,
  cancelLabel: PropTypes.string
};
