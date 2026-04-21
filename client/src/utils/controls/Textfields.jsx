import { Grid, TextField } from '@mui/material';
import React from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
//import { useTheme } from '@mui/material/styles';

function TextFieldV1({ label, value, onChange }) {
  return (
    <Grid>
      <TextField
        fullWidth
        label={label}
        margin="normal"
        type="text"
        defaultValue=""
        size="small"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </Grid>
  );
}

const FFCtrl = ({ field, form, label }) => {
  const { touched, errors } = form;
  const { name, value } = field;
  const isError = Boolean(touched[name] && errors[name]);

  return (
    <TextField
      fullWidth
      margin="normal"
      size="small"
      type="text"
      value={value}
      name={name}
      onBlur={form.handleBlur}
      onChange={form.handleChange}
      label={label}
      inputProps={{}}
      error={isError}
      helperText={isError ? errors[name] : ''}
    />
  );
};

export { TextFieldV1, FFCtrl };
