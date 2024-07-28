import React, { createContext, useState } from 'react';

const EmployeeContext = createContext();

const EmployeeProvider = ({ children }) => {
  const [employeeDetails, setEmployeeDetails] = useState(null);

  return (
    <EmployeeContext.Provider value={{ employeeDetails, setEmployeeDetails }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export { EmployeeContext, EmployeeProvider };
