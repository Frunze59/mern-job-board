/**
 * Pagination controls: prev / next plus a numbered button per page.
 * Prev and next stop at the ends rather than wrapping around.
 */
const PageBtnContainer = ({ page, numOfPages, onPageChange }) => {
  const pages = Array.from({ length: numOfPages }, (_, index) => index + 1);

  return (
    <section className="pagination">
      <button
        type="button"
        className="btn btn-small"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        prev
      </button>

      <div className="page-numbers">
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`btn btn-small ${pageNumber === page ? '' : 'btn-muted'}`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-small"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= numOfPages}
      >
        next
      </button>

      <span className="page-status">
        page {page} of {numOfPages}
      </span>
    </section>
  );
};

export default PageBtnContainer;
