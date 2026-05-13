// i18n/strings.ts
export type Lang = 'en' | 'ko';

export const strings = {
  en: {
    appName: 'AGING APP',
    appSubtitle: 'Phase 2 · Upload + Parsing Preview',
    searchPlaceholder: 'Search rows (available after import)',

    // Drop zone
    dropZoneTitle: 'Drop Excel files here',
    dropZoneSub: 'or use the buttons below',
    browse: 'Browse Files',
    loadBaseline: 'Load Baseline Demo',
    loadingBaseline: 'Loading…',
    clear: 'Clear',
    confirmImport: 'Confirm Import',
    exportJson: 'Export JSON',
    exportCsv: 'Export Review CSV',

    // API
    apiOnline: 'API online',
    apiOffline: 'API offline',
    sourceApi: 'Source · API',
    sourceFallback: 'Source · Fallback',

    // Upload-not-supported modal (P1-1 fix)
    uploadDisabledTitle: 'Live file parsing is not enabled in this build',
    uploadDisabledBody:
      'This release ships demo data only. Files you select are NOT analyzed. ' +
      'Live .xls / .xlsx parsing is planned for v1.2 (POST /api/parse-upload). ' +
      'You can load the demo baseline instead to preview the workflow.',
    uploadDisabledFiles: 'Files you tried to upload',
    uploadDisabledLoadDemo: 'Load demo baseline instead',
    close: 'Close',

    // Readiness
    importReadiness: 'Import Readiness',
    statusReady: 'Ready',
    statusNeedsReview: 'Needs Review',
    statusBlocked: 'Blocked',
    statusEmpty: 'No data loaded',
    files: 'Files',
    critical: 'Critical',
    warnings: 'Warnings',
    info: 'Info',
    reviewItems: 'Review Items',

    // Tabs
    tabFiles: 'Files',
    tabReconciliation: 'ERP Reconciliation',
    tabStatements: 'Statements',
    tabReviewQueue: 'Review Queue',
    tabRawJson: 'Raw JSON',

    // Files tab
    file: 'File',
    detectedType: 'Detected Type',
    confidence: 'Confidence',
    rules: 'Rules',
    rows: 'Rows',
    sheet: 'Sheet',

    // Reconciliation
    type: 'Type',
    sourceRows: 'Source Rows',
    parsed: 'Parsed',
    skipped: 'Skipped',
    rejected: 'Rejected',
    sourceTotal: 'Source Computed',
    parsedTotal: 'Parsed Total',
    diff: 'Diff',
    match: 'Match',
    pass: 'PASS',
    fail: 'FAIL',
    diffStatusZero: 'Diff = 0',

    // Statements
    agentStatements: 'Agent Statements',
    localStatements: 'Local Statements',
    statements: 'Statements',
    txRefs: 'Transaction Refs',
    matched: 'Matched',
    unmatched: 'Unmatched',
    identityMismatches: 'Identity Mismatches',
    asOfDateMismatches: 'As-of Date Mismatches',
    settledAfterStatement: 'Settled After Statement',
    changedAfterStatement: 'Changed After Statement',
    erpRefsFound: 'ERP Refs Found',
    exactMatches: 'Exact Signed-Balance Matches',
    balanceDifferences: 'Balance Differences',
    outsideDateRange: 'Outside ERP Date Range',
    sameRefDiffCurrency: 'Same Ref / Different Currency',
    rowsWithoutRef: 'Rows Without Reference Number',
    notInExtract: 'Not in Uploaded ERP Extract',
    erpDateRange: 'Uploaded ERP Transaction Date Range',
    asOfNotice:
      'Statement balances are compared with the current ERP balance as of the import date. Differences may indicate settlement or adjustment after the statement date.',

    // Review queue
    reviewLocalCandidates: 'Local Review Candidates',
    reviewLocalDescription:
      '7 rows remain as business review candidates after separating historical, currency-mismatch, and ref-less rows.',
    reviewDuplicates: 'Duplicate Candidates',
    reviewDuplicatesDescription:
      'Exact duplicates kept in parsed totals, flagged for review, never auto-excluded.',
    party: 'Party',
    date: 'Date',
    ref: 'Ref',
    invoice: 'Invoice',
    currency: 'Currency',
    balance: 'Balance',
    impact: 'Potential Signed Impact',
    identityKey: 'Identity Key',
    count: 'Count',

    // Confirm modal
    confirmTitle: 'Confirm Import',
    confirmFiles: 'Files classified',
    confirmReconciliation: 'ERP reconciliation',
    confirmCritical: 'Critical errors',
    confirmCandidates: 'Review candidates',
    confirmBody: 'This will load the parsed data into the workspace.',
    cancel: 'Cancel',
    importPassed: 'Passed',

    // Empty state
    emptyTitle: 'No data loaded yet',
    emptySub:
      'Drop Excel files above or click "Load Baseline Demo" to preview using the Phase 1 baseline data set.',

    // Misc
    asOfDate: 'As-of Date',
    importBatchId: 'Import Batch',
    user: 'User',
    timestamp: 'Timestamp',
    spec: 'Spec',
    schema: 'Schema',
    parser: 'Parser',
    direction: 'Direction',
    receivable: 'Receivable',
    payable: 'Payable',
    settled: 'Settled',
    signedBalance: 'Signed Balance',
    absoluteBalance: 'Absolute Balance',
    zeroBalance: 'Zero Balance',
    duplicateReview: 'Duplicate Review',
    groups: 'Groups',
    transactions: 'Transactions',
    nothingToReview: 'Nothing to review',
  },
  ko: {
    appName: 'AGING APP',
    appSubtitle: 'Phase 2 · 업로드 + 파싱 미리보기',
    searchPlaceholder: '행 검색 (가져오기 후 활성화)',

    dropZoneTitle: 'Excel 파일을 드롭하세요',
    dropZoneSub: '또는 아래 버튼을 사용하세요',
    browse: '파일 선택',
    loadBaseline: '베이스라인 데모 불러오기',
    loadingBaseline: '불러오는 중',
    clear: '초기화',
    confirmImport: '가져오기 확정',
    exportJson: 'JSON 내보내기',
    exportCsv: '검토용 CSV 내보내기',

    // API
    apiOnline: 'API 연결됨',
    apiOffline: 'API 미연결',
    sourceApi: '출처 · API',
    sourceFallback: '출처 · 내장본',

    // Upload-not-supported modal
    uploadDisabledTitle: '이 빌드는 실제 파일 파싱을 지원하지 않습니다',
    uploadDisabledBody:
      '현재 버전은 데모 데이터만 표시합니다. 선택하신 파일은 분석되지 않습니다. ' +
      '실제 .xls / .xlsx 파싱은 v1.2 (POST /api/parse-upload)에서 추가됩니다. ' +
      '워크플로우 미리보기는 데모 베이스라인을 사용해 주세요.',
    uploadDisabledFiles: '업로드 시도한 파일',
    uploadDisabledLoadDemo: '데모 베이스라인 불러오기',
    close: '닫기',

    importReadiness: '가져오기 준비 상태',
    statusReady: '준비됨',
    statusNeedsReview: '검토 필요',
    statusBlocked: '진행 불가',
    statusEmpty: '데이터 없음',
    files: '파일',
    critical: '중대 오류',
    warnings: '경고',
    info: '정보',
    reviewItems: '검토 항목',

    tabFiles: '파일',
    tabReconciliation: 'ERP 정합성',
    tabStatements: 'Statement',
    tabReviewQueue: '검토 대기열',
    tabRawJson: '원본 JSON',

    file: '파일',
    detectedType: '감지 타입',
    confidence: '신뢰도',
    rules: '룰',
    rows: '행 수',
    sheet: '시트',

    type: '타입',
    sourceRows: '원본 행',
    parsed: '파싱됨',
    skipped: '스킵',
    rejected: '거부',
    sourceTotal: '원본 합계',
    parsedTotal: '파싱 합계',
    diff: '차이',
    match: '일치',
    pass: '통과',
    fail: '실패',
    diffStatusZero: '차이 = 0',

    agentStatements: 'Agent Statement',
    localStatements: 'Local Statement',
    statements: 'Statement 수',
    txRefs: '거래 참조',
    matched: '매칭',
    unmatched: '매칭 안됨',
    identityMismatches: '거래처 불일치',
    asOfDateMismatches: '발행일 불일치',
    settledAfterStatement: 'Statement 이후 정산',
    changedAfterStatement: 'Statement 이후 변동',
    erpRefsFound: 'ERP에서 발견',
    exactMatches: '잔액 정확 일치',
    balanceDifferences: '잔액 차이',
    outsideDateRange: 'ERP 기간 밖',
    sameRefDiffCurrency: '동일 참조 / 다른 통화',
    rowsWithoutRef: '참조번호 없는 행',
    notInExtract: 'ERP 추출 데이터에 없음',
    erpDateRange: '업로드된 ERP 거래 기간',
    asOfNotice:
      'Statement 금액은 발행일 기준이고 ERP 금액은 업로드 기준일 현재 금액입니다. 차이는 발행 후 정산 또는 조정으로 발생할 수 있습니다.',

    reviewLocalCandidates: 'Local 검토 후보',
    reviewLocalDescription:
      '과거 거래, 통화 불일치, 참조번호 없는 행을 분리한 후 남은 7건의 검토 대상입니다.',
    reviewDuplicates: '중복 후보',
    reviewDuplicatesDescription:
      '정확한 중복은 파싱 합계에 보존되고 검토용으로만 표시됩니다. 자동 제외되지 않습니다.',
    party: '거래처',
    date: '날짜',
    ref: '참조',
    invoice: '송장',
    currency: '통화',
    balance: '잔액',
    impact: '잠재 영향',
    identityKey: '식별키',
    count: '건수',

    confirmTitle: '가져오기 확정',
    confirmFiles: '분류된 파일',
    confirmReconciliation: 'ERP 정합성',
    confirmCritical: '중대 오류',
    confirmCandidates: '검토 후보',
    confirmBody: '이 데이터를 워크스페이스에 불러옵니다.',
    cancel: '취소',
    importPassed: '통과',

    emptyTitle: '아직 데이터가 없습니다',
    emptySub:
      '위에 Excel 파일을 드롭하거나 "베이스라인 데모 불러오기"를 클릭해서 Phase 1 검증 데이터로 미리 볼 수 있습니다.',

    asOfDate: '기준일',
    importBatchId: '배치 ID',
    user: '사용자',
    timestamp: '시각',
    spec: 'Spec',
    schema: 'Schema',
    parser: 'Parser',
    direction: '방향',
    receivable: '받을 돈',
    payable: '줄 돈',
    settled: '정산 완료',
    signedBalance: '부호 잔액',
    absoluteBalance: '절대 잔액',
    zeroBalance: '잔액 0',
    duplicateReview: '중복 검토',
    groups: '그룹',
    transactions: '거래',
    nothingToReview: '검토 항목 없음',
  },
} as const;

export type StringKey = keyof typeof strings.en;
