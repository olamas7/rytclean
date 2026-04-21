//import React from "react";
import axios from 'axios';


const listYears = () => {
  const minYear = 1980;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= minYear; year--) {
    years.push(year);
  }
  return years;
};

const occupations = [
  { label: 'Doctor', id: 1 },
  { label: 'Engineer', id: 2 },
  { label: 'Teacher', id: 3 }
];
const cities = [
  { label: 'Accra', id: 1 },
  { label: 'Kumasi', id: 2 }
];
const towns = [
  { label: 'Town A', id: 1 },
  { label: 'Town B', id: 2 }
];
const educationLevels = [
  { label: 'Primary', id: 1 },
  { label: 'Secondary', id: 2 },
  { label: 'Tertiary', id: 3 },
  { label: 'None', id: 4 }
];
const maritalStatuses = [
  { label: 'Single', id: 1 },
  { label: 'Married', id: 2 },
  { label: 'Divorced', id: 3 }
];
const genders = [
  { label: 'Male', id: 1 },
  { label: 'Female', id: 2 }
];

const yesno = [{label:'Yes', id: 1}, {label:'No', id: 2}];


export { genders, yesno, maritalStatuses, educationLevels, towns, cities, occupations, listYears };
