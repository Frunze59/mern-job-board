/**
 * Labelled text input.
 * props: type, name, labelText?, value, onChange, autoComplete?, required?
 */
const FormRow = ({
  type,
  name,
  labelText,
  value,
  onChange,
  autoComplete,
  required = true,
}) => {
  return (
    <div className="form-row">
      <label htmlFor={name} className="form-label">
        {labelText || name}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        className="form-input"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
      />
    </div>
  );
};

export default FormRow;
