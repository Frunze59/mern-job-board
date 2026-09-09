/**
 * Pagination controls: prev / next + "page X of Y".
 * props: page, numOfPages, onPageChange
 */
const PageBtnContainer = ({ page = 1, numOfPages = 1, onPageChange }) => {
  const prev = () => onPageChange?.(page === 1 ? numOfPages : page - 1);
  const next = () => onPageChange?.(page === numOfPages ? 1 : page + 1);

  return (
    <section className="pagination">
      <button type="button" className="btn" onClick={prev}>
        prev
      </button>
      <span>
        page {page} of {numOfPages}
      </span>
      <button type="button" className="btn" onClick={next}>
        next
      </button>
    </section>
  );
};

export default PageBtnContainer;
