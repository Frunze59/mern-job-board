import { useState } from 'react';
import { Link } from 'react-router-dom';
import formatDate from '../utils/formatDate';

/**
 * A single job.
 *
 * Delete is a two-step action: the first click arms it and the second confirms,
 * so a misplaced click cannot destroy a record outright.
 *
 * `canWrite` comes from the caller rather than from context, so this stays a
 * plain presentational component. When it is false the whole footer is left
 * out: every control in it is a write.
 */
const JobCard = ({
  _id,
  position,
  company,
  jobLocation,
  jobType,
  status,
  createdAt,
  createdByName,
  onDelete,
  isDeleting = false,
  canWrite = false,
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

      {/* Jobs now belong to an org rather than to one person, so whose entry
          this is stops being obvious. The API returns null when the author's
          account is gone; the job itself is still the team's. */}
      <p className="job-author">added by {createdByName ?? 'a former member'}</p>

      {canWrite && (
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
      )}
    </article>
  );
};

export default JobCard;
