/**
 * Labelled select.
 * props: name, labelText?, list (array of option values), value, onChange
 */
const FormRowSelect = ({ name, labelText, list, value, onChange }) => {
  return (
    <div className="form-row">
      <label htmlFor={name} className="form-label">
        {labelText || name}
      </label>
      <select id={name} name={name} className="form-select" value={value} onChange={onChange}>
        {list.map((itemValue) => (
          <option key={itemValue} value={itemValue}>
            {itemValue}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FormRowSelect;
