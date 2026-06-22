import type {
    GetAccountApikeysResponses,
    GetAccountResponses,
    GetPackagesByFullPackageNameReleasesResponses,
    GetPackagesByFullPackageNameResponses,
    GetPackagesByFullPackageNameRoleAssignmentsResponses,
    GetPackagesByFullPackageNameStablePromotionRequestsResponses,
    GetPackagesResponses,
    GetPublishersByPublisherNameMembersResponses,
    GetPublishersResponses,
    PostAccountApikeysData,
    PostPackagesByFullPackageNameReleasesData,
    PostPackagesByFullPackageNameStablePromotionRequestsData,
    PostPackagesData,
    PostPublishersData,
} from "~/api-client";

export namespace UtilityTypes {

    export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

}


export type UserInfo = GetAccountResponses["200"]["data"];

export type DevPackage = GetPackagesResponses["200"]["data"][number];
export type NewDevPackage = NonNullable<PostPackagesData["body"]>;
export type DevPackageDetail = GetPackagesByFullPackageNameResponses["200"]["data"];

export type DevPackageRelease = GetPackagesByFullPackageNameReleasesResponses["200"]["data"][number];
export type NewDevPackageRelease = NonNullable<PostPackagesByFullPackageNameReleasesData["body"]>;


export type APIKey = GetAccountApikeysResponses["200"]["data"][number];
export type NewAPIKey = NonNullable<PostAccountApikeysData["body"]>;

export type DevPackageStablePromotionRequest = GetPackagesByFullPackageNameStablePromotionRequestsResponses["200"]["data"][number];
export type NewDevPackageStablePromotionRequest = NonNullable<PostPackagesByFullPackageNameStablePromotionRequestsData["body"]>;

export type Publisher = GetPublishersResponses["200"]["data"][number];
export type NewPublisher = NonNullable<PostPublishersData["body"]>;

export type PublisherMember = GetPublishersByPublisherNameMembersResponses["200"]["data"][number];

export type PackageRoleAssignment = GetPackagesByFullPackageNameRoleAssignmentsResponses["200"]["data"][number];
