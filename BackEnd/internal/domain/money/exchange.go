package money

// FallbackUsdToDopRate is the USD->DOP rate used when the exchange-rate
// service is unreachable or returns a non-positive rate. It matches the
// fallback (60) of the transaction, budget and monthly plan modules.
var FallbackUsdToDopRate = FromInt(60)
