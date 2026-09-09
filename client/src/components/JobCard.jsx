import { useState } from 'react';
import { Link } from 'react-router-dom';
import formatDate from '../utils/formatDate';

/**
 * A single job.
 *
 * Delete is a two-step action: the first click arms it and the second confirms,
 * so a misplaced click cannot destroy a record outright.
 */
const JobCard = ({
  _id,
  position,
  company,
  jobLocation,
  jobType,
  status,
  createdAt,
  onDelete,
  isDeleting = false,
}) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <article className="job-card">
      <header className="job-card-header">
        <h4>{position}</h4>
        <p className="job-company">{company}</p>
      </header>

      <div className="job-info">
        <span>{jobLocation}</span>
        <span>{jobType}</span>
        <span>{formatDate(createdAt)}</span>
        <span className={`status ${status}`}>{status}</span>
      </div>

      <footer className="job-actions">
        <Link to={`/dashboard/edit-job/${_id}`} className="btn btn-small">
          edit
        </Link>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => onDelete(_id)}
              disabled={isDeleting}
            >
              {isDeleting ? 'deleting...' : 'confirm'}
            </button>
            <button
              type="button"
              className="btn btn-small btn-muted"
              onClick={() => setConfirming(false)}
              disabled={isDeleting}
            >
              cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-small btn-danger"
            onClick={() => setConfirming(true)}
          >
            delete
          </button>
        )}
      </footer>
    </article>
  );
};

export default JobCard;
