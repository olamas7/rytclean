import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // import styles
import { Controller } from 'react-hook-form';
import { Box, FormHelperText } from '@mui/material';

const modules = {
  toolbar: [
    [{ header: '1' }, { header: '2' }, { font: [] }],
    [{ size: [] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    ['link', 'image', 'video'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false
  }
};

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent',
  'link', 'image', 'video'
];

const RichTextEditor = ({ name, control, ...props }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Box
          sx={{
            background: '#f0f0f0', // A neutral background to make the "paper" stand out
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            '.ql-toolbar': {
              '@media print': {
                display: 'none' // Hide toolbar when printing
              }
            },
            '.ql-container': {
              '@media print': {
                border: 'none' // Hide container border when printing
              }
            },
            // Make the editor background transparent to see the page break lines
            '.ql-editor': {
              background: 'transparent',
            }
          }}
        >
          <Box
            className="a4-paper"
            sx={{
              position: 'relative', // Required for pseudo-element positioning
              width: '210mm',
              minHeight: '297mm',
              p: '15mm', // A reasonable margin for the page
              backgroundColor: 'white',
              boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
              // This pseudo-element creates the visual page break lines
              '&::after': {
                content: '""',
                position: 'absolute',
                zIndex: 0,
                top: 0,
                bottom: 0,
                left: '15mm',
                right: '15mm',
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0, transparent 296.5mm, #ccc 296.5mm, #ccc 297mm)',
                backgroundSize: '100% 297mm',
                pointerEvents: 'none', // Don't let it interfere with mouse events
              },
              '@media print': {
                boxShadow: 'none',
                p: 0,
                margin: 0,
                width: '100%',
                minHeight: 'unset',
                '&::after': {
                  display: 'none', // Hide the visual guide when printing
                },
              }
            }}
          >
            <ReactQuill
              theme="snow"
              value={field.value || ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              modules={modules}
              formats={formats}
              {...props}
            />
          </Box>
          {error && (
            <FormHelperText error sx={{ width: '210mm', mt: 1 }}>
              {error.message}
            </FormHelperText>
          )}
        </Box>
      )}
    />
  );
};

export default RichTextEditor;
