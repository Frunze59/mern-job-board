// import { useEffect, useState } from 'react';
// import customFetch, { getErrorMessage } from '../utils/customFetch';

/**
 * /dashboard/stats
 *
 * GET /stats for the active org and render:
 *  - three stat tiles for countsByStatus
 *  - a simple bar list for applicationsPerMonth (plain CSS bars are enough;
 *    no chart library needed for six bars)
 *  - a small table for topCompanies
 *
 * TODO: implement.
 */
const Stats = () => {
  return (
    <section>
      <h2>Stats</h2>
      <p className="empty-state">TODO: counts by status, per month, top companies.</p>
    </section>
  );
};

export default Stats;
