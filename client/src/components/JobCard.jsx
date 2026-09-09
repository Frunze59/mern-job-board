// import { Link } from 'react-router-dom';

/**
 * Single job card.
 * Shows: position, company, jobLocation, status badge, jobType, created date.
 * Actions: Edit (link to /dashboard/edit-job/:id) and Delete (calls onDelete(id)).
 *
 * TODO: format createdAt (e.g. new Date(createdAt).toLocaleDateString()).
 */
const JobCard = ({ _id, position, company, jobLocation, jobType, status, createdAt, onDelete }) => {
  return (
    <article className="job-card">
      <header>
        <h4>{position}</h4>
        <p>{company}</p>
      </header>
      <div className="job-info">
        <span>{jobLocation}</span>
        <span>{jobType}</span>
        <span>{createdAt}</span>
        <span className={`status ${status}`}>{status}</span>
      </div>
      <footer className="actions">
        {/* <Link to={`/dashboard/edit-job/${_id}`} className="btn">edit</Link> */}
        <button type="button" className="btn" onClick={() => onDelete?.(_id)}>
          delete
        </button>
      </footer>
    </article>
  );
};

export default JobCard;
