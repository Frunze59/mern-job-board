/**
 * Labelled text input.
 * props: type, name, labelText?, value, onChange, autoComplete?
 */
const FormRow = ({ type, name, labelText, value, onChange, autoComplete }) => {
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
        required
      />
    </div>
  );
};

export default FormRow;
