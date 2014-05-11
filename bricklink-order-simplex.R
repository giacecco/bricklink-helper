# Install and load any required packages
.requiredPackages <- c("linprog")
.packagesToInstall <- setdiff(.requiredPackages, installed.packages())
if (length(.packagesToInstall) > 0) install.packages(.packagesToInstall)
sapply(.requiredPackages, require, character.only = TRUE)

# Read the data from the exchange folder.
args <- commandArgs(trailingOnly = TRUE)
parts_list <- read.csv(if (!is.na(args[1])) args[1] else ".r-exchange/partsList.csv", stringsAsFactors = FALSE)
availability <- read.csv(if (!is.na(args[2])) args[2] else ".r-exchange/availability.csv", stringsAsFactors = FALSE)

# Create the reference part id list. Note that I ignore both:
# a) the requirement for part ids that are not available on the market, and
# b) the availability of part ids that are not a requirement
# TODO: did I find a suitable place to warn the user about the parts that
#       could not be found on the market? 
part_id_reference <- sort(intersect(unique(availability$partId), unique(parts_list$partId)))
N <- length(part_id_reference)

# Create the reference seller list. Note that I ignore the availability of 
# parts that are not in the reference parts list created above.
sellers_reference <- sort(unique(availability[availability$partId %in% part_id_reference, c('sellerUsername')]))
M <- length(sellers_reference)

# See the documentation at http://dico.im/1nBkI4i ; the following creates the 
# elements of the integer linear programming problem as required to get to 
# standard form and apply the simplex algorithm.

# prices is a matrix witn one row for each seller and one column for each part 
# id
prices <- t(sapply(sellers_reference, function (seller_username) {
    return(sapply(part_id_reference, function (part_id) {
        prices_per_seller <- availability[(availability$sellerUsername == seller_username) & 
                                              (availability$partId == part_id), ]$price
        return(if (length(prices_per_seller) == 0) 0. else max(prices_per_seller))
    }, USE.NAMES = FALSE))
}, USE.NAMES = FALSE))

# 'c' is a quite reserved word in R! :-)
c_ <- t(as.vector(t(prices)))

r <- sapply(part_id_reference, function (part_id) {
    q <- sum(parts_list[parts_list$partId == part_id, c("quantity")])
    return(if(!is.na(q)) q else 0)    
})

v <- sapply(sellers_reference, function (seller_username) {
    minBuy <- availability[availability$sellerUsername == seller_username, c("minBuy")][1]
    return(if(!is.na(minBuy)) minBuy else 0)
}, USE.NAMES = FALSE)

b <- c(c_, r, v)

# Start assembling the A matrix. Note that linprog does not need the normal 
# form.
# top group of rows
A1 <- matrix(nrow = N, ncol = 0)
for(x in seq(M)) A1 <- cbind(A1, diag(1, N))
# middle group of rows
A2 <- diag(1, N * M)
# bottom group of rows
A3 <- matrix(nrow = M, ncol = 0)
for(x in seq(M)) {
    A3 <- cbind(A3, rbind(
        matrix(0, nrow = x - 1, ncol = N),    
        prices[x, ],    
        matrix(0, nrow = M - x, ncol = N)    
    ))
}
# all together now!
A <- rbind(A1, A2, A3)
rm(A1, A2, A3)

solveLP(c_, b, A, 
        maximum = FALSE, 
        const.dir = c(rep("==", N), rep("<=", N * M), rep(">=", M)), 
        lpSolve = TRUE)
